import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "node:path";

export const runtime = "nodejs";

let busy = false;

export async function POST(req: NextRequest) {
  if (busy) return new Response(JSON.stringify({ error: "현재 작업 중" }), { status: 429 });
  busy = true;

  try {
    const { ip, username, password, startExt, endExt, entity } = await req.json();

    const pythonBin = process.env.PYTHON_BIN || "python";
    let scriptPath = process.env.PY_SCRIPT_PATH || "python-scripts/bulk_create_extensions.py";
    if (!path.isAbsolute(scriptPath)) {
      scriptPath = path.join(process.cwd(), scriptPath);
    }

    const child = spawn(pythonBin, [scriptPath], {
      env: {
        ...process.env,
        LOGIN_URL: ip,
        SIP_USERNAME: username,
        SIP_PASSWORD: password,
        START_EXT: String(startExt),
        END_EXT: String(endExt),
        ENTITY: entity || "",
      },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const code: number = await new Promise((resolve) => {
      child.on("close", (c) => resolve(c ?? 0));
    });

    return new Response(JSON.stringify({ code, stdout, stderr }), {
      status: code === 0 ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  } finally {
    busy = false;
  }
}
