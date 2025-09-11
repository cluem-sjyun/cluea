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
const job: JobState = { status: "idle", child: null, cancelRequested: false, cancelFlagPath: null };

function toAbs(p: string) { return path.isAbsolute(p) ? p : path.join(process.cwd(), p); }
function ensureCancelFlag() {
  const fp = path.join(os.tmpdir(), `user-creator-cancel.flag`);
  try { fs.writeFileSync(fp, "0"); } catch {}
  return fp;
}
function writeCancelFlag(p?: string | null) { if (!p) return; try { fs.writeFileSync(p, "1"); } catch {} }
function clearCancelFlag(p?: string | null) { if (!p) return; try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {} }
function resolvePython() { return process.env.PYTHON_BIN?.trim() || (process.platform === "win32" ? "python" : "python3"); }

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
    const { ip, username, password, jobs } = body || {};
    if (!ip || !username || !password) {
      job.status = "idle"; clearCancelFlag(job.cancelFlagPath); job.cancelFlagPath = null;
      return new Response(JSON.stringify({ error: "IP/계정/비밀번호는 필수입니다." }), { status: 400 });
    }
    if (!Array.isArray(jobs) || jobs.length === 0) {
      job.status = "idle"; clearCancelFlag(job.cancelFlagPath); job.cancelFlagPath = null;
      return new Response(JSON.stringify({ error: "jobs 배열이 비었습니다." }), { status: 400 });
    }

    const pyBin = resolvePython();
    let scriptPath = process.env.PY_CREATOR_SCRIPT_PATH || "python-scripts/attach_create_user_extensions.py";
    let resolved = toAbs(scriptPath);
    if (!fs.existsSync(resolved)) {
      const alt = scriptPath.replace("python-script", "python-scripts").replace("python-scripts", "python-script");
      const altAbs = toAbs(alt);
      if (fs.existsSync(altAbs)) resolved = altAbs;
    }
    if (!fs.existsSync(resolved)) {
      job.status = "idle"; clearCancelFlag(job.cancelFlagPath); job.cancelFlagPath = null;
      return new Response(JSON.stringify({ error: `스크립트를 찾을 수 없습니다: ${resolved}` }), { status: 400 });
    }

    // ✅ 한 번만 스폰하고, 모든 묶음을 JOBS_JSON 으로 전달
    const child = spawn(pyBin, [resolved], {
      env: {
        ...process.env,
        LOGIN_URL: String(ip),
        USER_USERNAME: String(username),
        USER_PASSWORD: String(password),
        JOBS_JSON: JSON.stringify(jobs),              // ← 여기에 전부 담아 보냄
        CANCEL_FLAG_FILE: job.cancelFlagPath || "",
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    job.child = child;
    job.status = "running";

    // 이미 취소 요청돼 있으면 즉시 중단
    if (job.cancelRequested) {
      job.status = "stopping";
      writeCancelFlag(job.cancelFlagPath);
      await killTree(child.pid || 0);
    }

    let stdout = ""; let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const code: number = await new Promise((resolve) => child.on("close", (c) => resolve(c ?? 0)));

    job.child = null;
    job.cancelRequested = false;
    job.status = "idle";
    clearCancelFlag(job.cancelFlagPath); job.cancelFlagPath = null;

    return new Response(JSON.stringify({ code, stdout, stderr }), {
      status: code === 0 ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (job.child?.pid) { try { await killTree(job.child.pid); } catch {} }
    job.child = null;
    job.cancelRequested = false;
    job.status = "idle";
    clearCancelFlag(job.cancelFlagPath); job.cancelFlagPath = null;

    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
}

export async function stopCurrentChild() {
  job.cancelRequested = true;
  writeCancelFlag(job.cancelFlagPath);
  if (job.child?.pid) {
    job.status = "stopping";
    await killTree(job.child.pid);
  }
  job.child = null;
  job.status = "idle";
  job.cancelRequested = false;
  clearCancelFlag(job.cancelFlagPath); job.cancelFlagPath = null;
  return true;
}
