"use client";

import { useState } from "react";

type RangeRow = { start: string; end: string };

export default function UserDeleterPage() {
  // ✅ 기본값 통일: https://, mtcl, Cluemcluem123#
  const [ip, setIp] = useState("https://");
  const [username, setUsername] = useState("mtcl");
  const [password, setPassword] = useState("Cluemcluem123#");

  // ✅ 내선 범위 입력(여러 구간 가능)
  const [ranges, setRanges] = useState<RangeRow[]>([{ start: "", end: "" }]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<null | "ok" | "fail">(null);
  const [debugMsg, setDebugMsg] = useState<string>("");

  // 행 추가/삭제/수정
  const addRow = (afterIdx?: number) =>
    setRanges((rows) => {
      const next = [...rows];
      const insertAt = typeof afterIdx === "number" ? afterIdx + 1 : rows.length;
      next.splice(insertAt, 0, { start: "", end: "" });
      return next;
    });

  const removeRow = (idx: number) =>
    setRanges((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)));

  const updateRow = (idx: number, key: keyof RangeRow, value: string) =>
    setRanges((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

  async function downloadDebugBat() {
    window.location.href = "/api/chrome-debug-bat";
  }

  async function checkDebugPort() {
    setDebugStatus(null);
    setDebugMsg("확인 중...");
    try {
      const res = await fetch("http://127.0.0.1:9222/json/version", { cache: "no-store" });
      if (!res.ok) {
        setDebugStatus("fail");
        setDebugMsg(`응답 오류: ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data?.webSocketDebuggerUrl) {
        setDebugStatus("ok");
        setDebugMsg("디버그 포트 감지됨 ✅");
      } else {
        setDebugStatus("fail");
        setDebugMsg("디버그 포트 응답은 있었으나 예상 필드가 없습니다.");
      }
    } catch (e: any) {
      setDebugStatus("fail");
      setDebugMsg(`연결 실패: ${e?.message || e}`);
    }
  }

  const submit = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      if (!ip || !ip.startsWith("https://")) {
        throw new Error("IP/URL은 https://로 시작해야 합니다.");
      }

      // 문자열 → 정수 또는 undefined
      const toInt = (v: string): number | undefined => {
        const t = (v ?? "").trim();
        if (t === "") return undefined;
        const n = Number(t);
        return Number.isInteger(n) ? n : undefined;
      };

      const extList: number[] = [];

      for (const row of ranges) {
        const s = toInt(row.start);
        const e = toInt(row.end);

        // 둘 중 하나라도 비었으면 이 행은 무시 (빈칸 허용)
        if (s === undefined || e === undefined) continue;

        const [from, to] = s <= e ? [s, e] : [e, s];
        for (let n = from; n <= to; n++) extList.push(n);
      }

      if (extList.length === 0) {
        throw new Error("삭제할 내선번호가 없습니다. (빈 줄은 무시됩니다)");
      }

      // 중복 제거 + 정렬
      const uniq = Array.from(new Set(extList)).sort((a, b) => a - b);

      const res = await fetch("/api/user-deleter-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, username, password, extList: uniq }),
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 500));
      }

      if (!res.ok) throw new Error(data?.stderr || data?.error || "실패");
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "에러");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 16, display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>User Deleter</h1>

      {/* 디버그 모드 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={downloadDebugBat} className="border px-3 py-2 rounded bg-gray-50">
          실행 전 크롬을 디버그모드로 실행시키기(필수)
        </button>
        <button onClick={checkDebugPort} className="border px-3 py-2 rounded">
          상태 확인
        </button>
        {debugStatus === "ok" && <span style={{ color: "green" }}>{debugMsg}</span>}
        {debugStatus === "fail" && <span style={{ color: "crimson" }}>{debugMsg}</span>}
        {debugStatus === null && debugMsg && <span>{debugMsg}</span>}
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span>IP/URL</span>
        <input
          className="border p-2 rounded"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="https://192.168.x.x"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>계정(기본값: mtcl)</span>
        <input
          className="border p-2 rounded"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>비밀번호(기본값: C로 시작하는)</span>
        <input
          type="password"
          className="border p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {/* ✅ 범위 입력 패널 (여러 행) */}
      <div className="border rounded p-3" style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 600 }}>내선번호 범위</div>

        {ranges.map((row, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="number"
              className="border p-2 rounded"
              value={row.start}
              onChange={(e) => updateRow(idx, "start", e.target.value)}
              placeholder="시작 (예: 1000)"
            />
            <input
              type="number"
              className="border p-2 rounded"
              value={row.end}
              onChange={(e) => updateRow(idx, "end", e.target.value)}
              placeholder="끝 (예: 1200)"
            />
            <button
              type="button"
              onClick={() => addRow(idx)}
              className="border px-3 py-2 rounded"
              title="아래에 범위 추가"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="border px-3 py-2 rounded"
              title="이 범위 삭제"
              disabled={ranges.length <= 1}
            >
              −
            </button>
          </div>
        ))}

        <div>
          <button
            type="button"
            onClick={() => addRow()}
            className="border px-3 py-2 rounded"
            title="행 추가"
          >
            + 범위 추가
          </button>
        </div>

        <small style={{ color: "#6b7280" }}>
          여러 범위를 추가할 수 있어요. 제출 시 각 범위를 확장해 일괄 삭제합니다.
        </small>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={loading} className="border px-4 py-2 rounded">
          {loading ? "삭제 중..." : "삭제 실행"}
        </button>
        {loading && (
          <button
            onClick={async () => {
              await fetch("/api/user-deleter-stop", { method: "POST" });
              setLoading(false);
              setError("작업이 중지되었습니다.");
            }}
            className="border px-4 py-2 rounded bg-red-100 text-red-700"
          >
            중지
          </button>
        )}
      </div>

      {error && <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{error}</div>}
      {result && (
        <pre className="text-sm whitespace-pre-wrap border rounded p-3 overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
