export const runtime = "nodejs";

export async function GET() {
  const bat = [
    '@echo off',
    'REM 크롬 디버그 포트(9222)로 실행',
    '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ^',
    '  --remote-debugging-port=9222 ^',
    '  --user-data-dir=C:\\chrome-sel-profile ^',
    '  --ignore-certificate-errors',
    'pause',
    ''
  ].join('\r\n');

  return new Response(bat, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="run_chrome_debug.bat"',
      "Cache-Control": "no-store",
    },
  });
}
