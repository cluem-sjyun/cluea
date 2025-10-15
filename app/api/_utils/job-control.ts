import type { ChildProcess } from "child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type JobStatus = "idle" | "starting" | "running" | "stopping";

export type JobState = {
  status: JobStatus;
  child: ChildProcess | null;
  cancelRequested: boolean;
  cancelFlagPath: string | null;
  flagFileName: string;
};

export function createJobState(flagFileName: string): JobState {
  return {
    status: "idle",
    child: null,
    cancelRequested: false,
    cancelFlagPath: null,
    flagFileName,
  };
}

export function beginJob(job: JobState) {
  job.status = "starting";
  job.cancelRequested = false;
  job.child = null;
  job.cancelFlagPath = ensureCancelFlagFile(job.flagFileName);
  return job.cancelFlagPath;
}

export function isJobIdle(job: JobState) {
  return job.status === "idle";
}

export function markJobRunning(job: JobState, child: ChildProcess) {
  job.child = child;
  job.status = "running";
}

export function writeCancelFlag(job: JobState) {
  writeCancelFlagPath(job.cancelFlagPath);
}

export function writeCancelFlagPath(flagPath?: string | null) {
  if (!flagPath) return;
  try {
    fs.writeFileSync(flagPath, "1", "utf8");
  } catch {}
}

export function clearCancelFlag(job: JobState) {
  clearCancelFlagPath(job.cancelFlagPath);
  job.cancelFlagPath = null;
}

export function clearCancelFlagPath(flagPath?: string | null) {
  if (!flagPath) return;
  try {
    if (fs.existsSync(flagPath)) {
      fs.unlinkSync(flagPath);
    }
  } catch {}
}

export function resetJob(job: JobState) {
  job.child = null;
  job.cancelRequested = false;
  job.status = "idle";
  clearCancelFlag(job);
}

export function toAbsolutePath(p: string) {
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

export function findScriptPath(scriptPath: string) {
  const candidates = new Set<string>([scriptPath]);
  if (scriptPath.includes("python-scripts")) {
    candidates.add(scriptPath.replace("python-scripts", "python-script"));
  }
  if (scriptPath.includes("python-script")) {
    candidates.add(scriptPath.replace("python-script", "python-scripts"));
  }

  for (const candidate of candidates) {
    const abs = toAbsolutePath(candidate);
    if (fs.existsSync(abs)) {
      return abs;
    }
  }

  return null;
}

export function resolvePython(binEnvVar?: string) {
  const explicit =
    (binEnvVar ? process.env[binEnvVar]?.trim() : undefined) ||
    process.env.PYTHON_BIN?.trim();

  if (explicit) return explicit;
  return process.platform === "win32" ? "python" : "python3";
}

export async function waitForChildClose(child: ChildProcess) {
  return await new Promise<number>((resolve) => {
    child.on("close", (code) => resolve(code ?? 0));
  });
}

export function captureChildOutput(child: ChildProcess) {
  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return () => ({ stdout, stderr });
}

function ensureCancelFlagFile(flagFileName: string) {
  const fp = path.join(os.tmpdir(), flagFileName);
  try {
    fs.writeFileSync(fp, "0", "utf8");
  } catch {}
  return fp;
}
