// app/kill-tree.ts
import { exec } from "node:child_process";

export function killTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    if (!pid) return resolve();

    if (process.platform === "win32") {
      // /T: 자식 포함, /F: 강제
      exec(`taskkill /PID ${pid} /T /F`, () => resolve());
    } else {
      try { process.kill(-pid, "SIGKILL"); } catch {}
      try { process.kill(pid, "SIGKILL"); } catch {}
      resolve();
    }
  });
}
