"use client";

import { useState } from "react";

export default function SipBulkPage() {
  const [ip, setIp] = useState("https://10.168.174.193");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [startExt, setStartExt] = useState<number>(1001);
  const [endExt, setEndExt] = useState<number>(1050);
  const [entity, setEntity] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/sip-bulk-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip,
          username,
          password,
          startExt,
          endExt,
          entity,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "실패");
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "에러가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 16, display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>SIP 확장 일괄 생성</h1>

      <label>
        <span>IP/URL</span>
        <input
          type="text"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          className="border p-2 rounded w-full"
        />
      </label>

      <label>
        <span>계정</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 rounded w-full"
        />
      </label>

      <label>
        <span>비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded w-full"
        />
      </label>

      <label>
        <span>시작 내선번호</span>
        <input
          type="number"
          value={startExt}
          onChange={(e) => setStartExt(Number(e.target.value))}
          className="border p-2 rounded"
        />
      </label>

      <label>
        <span>끝 내선번호</span>
        <input
          type="number"
          value={endExt}
          onChange={(e) => setEndExt(Number(e.target.value))}
          className="border p-2 rounded"
        />
      </label>

      <label>
        <span>엔티티 번호(선택)</span>
        <input
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          placeholder="예: 16 (미입력 가능)"
          className="border p-2 rounded"
        />
      </label>

      <button
        onClick={submit}
        disabled={loading}
        className="border px-4 py-2 rounded"
      >
        {loading ? "실행 중..." : "실행"}
      </button>

      {error && <div style={{ color: "crimson" }}>{error}</div>}
      {result && (
        <pre className="border rounded p-3 text-sm whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
