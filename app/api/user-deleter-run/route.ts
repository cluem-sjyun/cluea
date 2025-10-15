import { NextRequest } from "next/server";
import { killTree } from "@/app/kill-tree";
import {
  beginJob,
  captureChildOutput,
  createJobState,
  findScriptPath,
  isJobIdle,
  markJobRunning,
  resetJob,
  resolvePython,
  waitForChildClose,
  writeCancelFlag,
  writeCancelFlagPath,
} from "@/app/api/_utils/job-control";
import { spawn } from "child_process";
import type { ChildProcess } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const job = createJobState("user-deleter-cancel.flag");

async function gentleStop(child: ChildProcess, cancelPath: string | null) {
  // 1) 플래그로 파이썬에 “취소” 통지
  writeCancelFlagPath(cancelPath);

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

type DeleterPayload = {
  ip?: string;
  username?: string;
  password?: string;
  extList?: unknown;
  startExt?: unknown;
  endExt?: unknown;
};

function parseDeleterPayload(value: unknown): DeleterPayload {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    ip: typeof record.ip === "string" ? record.ip : undefined,
    username: typeof record.username === "string" ? record.username : undefined,
    password: typeof record.password === "string" ? record.password : undefined,
    extList: record.extList,
    startExt: record.startExt,
    endExt: record.endExt,
  };
}

function isIntegerValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export async function POST(req: NextRequest) {
  if (!isJobIdle(job)) {
    return new Response(JSON.stringify({ error: "현재 작업 중입니다." }), { status: 429 });
  }

  beginJob(job);

  try {
    const { ip, username, password, extList, startExt, endExt } = parseDeleterPayload(await req.json());

    if (!ip || !username || !password) {
      resetJob(job);
      return new Response(JSON.stringify({ error: "IP/계정/비밀번호는 필수입니다." }), { status: 400 });
    }

    const scriptPath =
      process.env.PY_DELETER_SCRIPT_PATH || "python-scripts/attach_delete_user_extensions.py";

    const resolved = findScriptPath(scriptPath);
    if (!resolved) {
      resetJob(job);
      return new Response(JSON.stringify({ error: `스크립트를 찾을 수 없습니다: ${scriptPath}` }), {
        status: 400,
      });
    }

    const pyBin = resolvePython();
    // extList 우선, 없으면 start/end 허용
    const envExtra: Record<string, string> = {};
    if (Array.isArray(extList) && extList.length > 0) {
      const cleaned = extList.filter((value: unknown): value is number => isIntegerValue(value));
      if (cleaned.length === 0) {
        resetJob(job);
        return new Response(JSON.stringify({ error: "유효한 내선번호가 없습니다." }), { status: 400 });
      }
      envExtra.START_EXT_LIST = cleaned.join(",");
    } else {
      if (!isIntegerValue(startExt) || !isIntegerValue(endExt)) {
        resetJob(job);
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

    markJobRunning(job, child);

    const collectOutput = captureChildOutput(child);

    // 혹시 실행 직후 이미 중지 요청이 들어와 있었으면 즉시 중지 경로로
    if (job.cancelRequested) {
      job.status = "stopping";
      await gentleStop(child, job.cancelFlagPath);
    }

    const code = await waitForChildClose(child);
    const { stdout, stderr } = collectOutput();

    resetJob(job);

    return new Response(JSON.stringify({ code, stdout, stderr }), {
      status: code === 0 ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    // 예외 시 자원 정리
    if (job.child?.pid) {
      try {
        await gentleStop(job.child, job.cancelFlagPath);
      } catch {}
    }
    resetJob(job);

    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function stopCurrentChild() {
  // 여러 번 눌러도 안전하도록 멱등 처리
  job.cancelRequested = true;

  // 플래그 먼저 기록
  writeCancelFlag(job);

  // 실행 중/시작 중일 때만 프로세스 종료 시도
  const child = job.child;
  if (child?.pid) {
    job.status = "stopping";
    await gentleStop(child, job.cancelFlagPath);
  }

  // 상태 리셋
  resetJob(job);

  return true;
}
