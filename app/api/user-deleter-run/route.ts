import { NextRequest } from "next/server";
import { spawn, ChildProcess } from "child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { killTree } from "@/app/kill-tree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JobState = {
  status: "idle" | "starting" | "running" | "stopping";
  child: ChildProcess | null;
  cancelRequested: boolean;
  cancelFlagPath: string | null;
};

const job: JobState = {
  status: "idle",
  child: null,
  cancelRequested: false,
  cancelFlagPath: null,
};

function toAbs(p: string) {
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

function ensureCancelFlag() {
  const fp = path.join(os.tmpdir(), `user-deleter-cancel.flag`);
  try {
    fs.writeFileSync(fp, "0", "utf8");
  } catch {}
  return fp;
}

function writeCancelFlag(p?: string | null) {
  if (!p) return;
  try {
    fs.writeFileSync(p, "1", "utf8");
  } catch {}
}

function clearCancelFlag(p?: string | null) {
  if (!p) return;
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

async function gentleStop(child: ChildProcess, cancelPath: string | null) {
  // 1) 플래그로 파이썬에 “취소” 통지
  writeCancelFlag(cancelPath);

  // 2) SIGTERM으로 정상 종료 유도
  const pid = child.pid;
  if (!pid) return;

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // 이미 종료된 경우 등
  }

  // 3) 5초 대기(이미 종료되면 바로 resolve)
  const finished = await new Promise<boolean>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(false);
    }, 5000);

    child.once("close", () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(true);
    });
    child.once("exit", () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(true);
    });
  });

  // 4) 안 죽었으면 트리 강제 종료
  if (!finished) {
    await killTree(pid);
  }
}

function resolvePython() {
  // 우선순위: env → python3 → python
  const fromEnv = process.env.PYTHON_BIN?.trim();
  if (fromEnv) return fromEnv;
  return process.platform === "win32" ? "python" : "python3";
}

export async function POST(req: NextRequest) {
  if (job.status !== "idle") {
    return new Response(JSON.stringify({ error: "현재 작업 중입니다." }), { status: 429 });
  }

  job.status = "starting";
  job.cancelRequested = false;
  job.child = null;
  job.cancelFlagPath = ensureCancelFlag();

  try {
    const body = await req.json();
    const { ip, username, password, extList, startExt, endExt } = body || {};

    if (!ip || !username || !password) {
      job.status = "idle";
      clearCancelFlag(job.cancelFlagPath);
      job.cancelFlagPath = null;
      return new Response(JSON.stringify({ error: "IP/계정/비밀번호는 필수입니다." }), { status: 400 });
    }

    const pyBin = resolvePython();
    let scriptPath =
      process.env.PY_DELETER_SCRIPT_PATH || "python-scripts/attach_delete_user_extensions.py";

    let resolved = toAbs(scriptPath);
    if (!fs.existsSync(resolved)) {
      // 오타 호환
      const alt = scriptPath
        .replace("python-script", "python-scripts")
        .replace("python-scripts", "python-script");
      const altAbs = toAbs(alt);
      if (fs.existsSync(altAbs)) resolved = altAbs;
    }
    if (!fs.existsSync(resolved)) {
      job.status = "idle";
      clearCancelFlag(job.cancelFlagPath);
      job.cancelFlagPath = null;
      return new Response(JSON.stringify({ error: `스크립트를 찾을 수 없습니다: ${resolved}` }), {
        status: 400,
      });
    }

    // extList 우선, 없으면 start/end 허용
    const envExtra: Record<string, string> = {};
    if (Array.isArray(extList) && extList.length > 0) {
      const cleaned = extList.filter((n: any) => Number.isInteger(n));
      if (cleaned.length === 0) {
        job.status = "idle";
        clearCancelFlag(job.cancelFlagPath);
        job.cancelFlagPath = null;
        return new Response(JSON.stringify({ error: "유효한 내선번호가 없습니다." }), { status: 400 });
      }
      envExtra.START_EXT_LIST = cleaned.join(",");
    } else {
      if (!Number.isInteger(startExt) || !Number.isInteger(endExt)) {
        job.status = "idle";
        clearCancelFlag(job.cancelFlagPath);
        job.cancelFlagPath = null;
        return new Response(JSON.stringify({ error: "시작/끝 내선번호는 정수여야 합니다." }), {
          status: 400,
        });
      }
      envExtra.START_EXT = String(startExt);
      envExtra.END_EXT = String(endExt);
    }

    const child = spawn(pyBin, [resolved], {
      env: {
        ...process.env,
        LOGIN_URL: String(ip),
        USER_USERNAME: String(username),
        USER_PASSWORD: String(password),
        CANCEL_FLAG_FILE: job.cancelFlagPath || "",
        ...envExtra,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    job.child = child;
    job.status = "running";

    // 혹시 실행 직후 이미 중지 요청이 들어와 있었으면 즉시 중지 경로로
    if (job.cancelRequested) {
      job.status = "stopping";
      await gentleStop(child, job.cancelFlagPath);
    }

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const code: number = await new Promise((resolve) =>
      child.on("close", (c) => resolve(c ?? 0)),
    );

    job.child = null;
    job.cancelRequested = false;
    job.status = "idle";
    clearCancelFlag(job.cancelFlagPath);
    job.cancelFlagPath = null;

    return new Response(JSON.stringify({ code, stdout, stderr }), {
      status: code === 0 ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    // 예외 시 자원 정리
    if (job.child?.pid) {
      try {
        await gentleStop(job.child, job.cancelFlagPath);
      } catch {}
    }
    job.child = null;
    job.cancelRequested = false;
    job.status = "idle";
    clearCancelFlag(job.cancelFlagPath);
    job.cancelFlagPath = null;

    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function stopCurrentChild() {
  // 여러 번 눌러도 안전하도록 멱등 처리
  job.cancelRequested = true;

  // 플래그 먼저 기록
  writeCancelFlag(job.cancelFlagPath);

  // 실행 중/시작 중일 때만 프로세스 종료 시도
  const child = job.child;
  if (child?.pid) {
    job.status = "stopping";
    await gentleStop(child, job.cancelFlagPath);
  }

  // 상태 리셋
  job.child = null;
  job.status = "idle";
  job.cancelRequested = false;
  clearCancelFlag(job.cancelFlagPath);
  job.cancelFlagPath = null;

  return true;
}
