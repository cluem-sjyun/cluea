import { NextRequest } from "next/server";
import { killTree } from "@/app/kill-tree";
import { spawn } from "child_process";
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
} from "@/app/api/_utils/job-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const job = createJobState("user-creator-cancel.flag");

type CreatorPayload = {
  ip?: string;
  username?: string;
  password?: string;
  jobs?: unknown;
};

function parseCreatorPayload(value: unknown): CreatorPayload {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    ip: typeof record.ip === "string" ? record.ip : undefined,
    username: typeof record.username === "string" ? record.username : undefined,
    password: typeof record.password === "string" ? record.password : undefined,
    jobs: record.jobs,
  };
}

export async function POST(req: NextRequest) {
  if (!isJobIdle(job)) {
    return new Response(JSON.stringify({ error: "현재 작업 중입니다." }), { status: 429 });
  }

  beginJob(job);

  try {
    const { ip, username, password, jobs } = parseCreatorPayload(await req.json());
    if (!ip || !username || !password) {
      resetJob(job);
      return new Response(JSON.stringify({ error: "IP/계정/비밀번호는 필수입니다." }), { status: 400 });
    }
    if (!Array.isArray(jobs) || jobs.length === 0) {
      resetJob(job);
      return new Response(JSON.stringify({ error: "jobs 배열이 비었습니다." }), { status: 400 });
    }

    const scriptPath = process.env.PY_CREATOR_SCRIPT_PATH || "python-scripts/attach_create_user_extensions.py";
    const resolved = findScriptPath(scriptPath);
    if (!resolved) {
      resetJob(job);
      return new Response(JSON.stringify({ error: `스크립트를 찾을 수 없습니다: ${scriptPath}` }), {
        status: 400,
      });
    }

    const pyBin = resolvePython();
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

    markJobRunning(job, child);

    const collectOutput = captureChildOutput(child);

    // 이미 취소 요청돼 있으면 즉시 중단
    if (job.cancelRequested) {
      job.status = "stopping";
      writeCancelFlag(job);
      await killTree(child.pid || 0);
    }

    const code = await waitForChildClose(child);
    const { stdout, stderr } = collectOutput();

    resetJob(job);

    return new Response(JSON.stringify({ code, stdout, stderr }), {
      status: code === 0 ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    if (job.child?.pid) {
      try {
        await killTree(job.child.pid);
      } catch {}
    }
    resetJob(job);

    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

export async function stopCurrentChild() {
  job.cancelRequested = true;
  writeCancelFlag(job);
  if (job.child?.pid) {
    job.status = "stopping";
    await killTree(job.child.pid);
  }
  resetJob(job);
  return true;
}
