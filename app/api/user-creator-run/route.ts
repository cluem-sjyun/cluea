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
  const fp = path.join(os.tmpdir(), `user-creator-cancel-${Date.now()}.flag`);
  try { fs.writeFileSync(fp, "0"); } catch {}
  return fp;
}
function writeCancelFlag(p?: string | null) {
  if (!p) return;
  try { fs.writeFileSync(p, "1"); } catch {}
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
    const {
      ip, username, password, startExt, endExt,
      entity, setTypeValue, setTypeText, huntGroup, pickupGroup,
    } = await req.json();

    if (!ip || !username || !password) {
      job.status = "idle";
      return new Response(JSON.stringify({ error: "IP/계정/비밀번호는 필수입니다." }), { status: 400 });
    }

    const pythonBin = process.env.PYTHON_BIN || "python";
    let scriptPath = process.env.PY_CREATOR_SCRIPT_PATH || "python-scripts/attach_create_user_extensions.py";

    let resolved = toAbs(scriptPath);
    if (!fs.existsSync(resolved)) {
      const alt = scriptPath.replace("python-script", "python-scripts").replace("python-scripts", "python-script");
      const altAbs = toAbs(alt);
      if (fs.existsSync(altAbs)) resolved = altAbs;
    }
    if (!fs.existsSync(resolved)) {
      job.status = "idle";
      return new Response(JSON.stringify({ error: `스크립트를 찾을 수 없습니다: ${resolved}` }), { status: 400 });
    }

    const child = spawn(pythonBin, [resolved], {
      env: {
        ...process.env,
        LOGIN_URL: String(ip),
        USER_USERNAME: String(username),
        USER_PASSWORD: String(password),
        START_EXT: String(startExt),
        END_EXT: String(endExt),
        ENTITY: entity ? String(entity) : "",
        SET_TYPE_VALUE: setTypeValue ? String(setTypeValue) : "",
        SET_TYPE_TEXT: setTypeText ? String(setTypeText) : "",
        HUNT_GROUP: huntGroup ? String(huntGroup) : "",
        PICKUP_GROUP: pickupGroup ? String(pickupGroup) : "",
        CANCEL_FLAG_FILE: job.cancelFlagPath || "",
      },
      windowsHide: true,
    });

    job.child = child;
    job.status = "running";

    // 실행 직후 이미 중지 예약 → 즉시 취소 신호 + 하드킬
    if (job.cancelRequested) {
      job.status = "stopping";
      writeCancelFlag(job.cancelFlagPath);
      await killTree(child.pid || 0);
    }

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const code: number = await new Promise((resolve) => child.on("close", (c) => resolve(c ?? 0)));

    job.child = null;
    job.cancelRequested = false;
    job.status = "idle";
    try { if (job.cancelFlagPath && fs.existsSync(job.cancelFlagPath)) fs.unlinkSync(job.cancelFlagPath); } catch {}
    job.cancelFlagPath = null;

    return new Response(JSON.stringify({ code, stdout, stderr }), {
      status: code === 0 ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    job.child = null;
    job.cancelRequested = false;
    job.status = "idle";
    try { if (job.cancelFlagPath && fs.existsSync(job.cancelFlagPath)) fs.unlinkSync(job.cancelFlagPath); } catch {}
    job.cancelFlagPath = null;
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
}

export async function stopCurrentChild() {
  job.cancelRequested = true;
  writeCancelFlag(job.cancelFlagPath);
  if (job.child?.pid) {
    job.status = "stopping";
    await killTree(job.child.pid);
    return true;
  }
  return true; // 아직 child 없으면 예약 취소
}
