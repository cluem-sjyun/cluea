"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type RangeRow = { start: string; end: string };

export default function UserDeleterPage() {
  const [ip, setIp] = useState("https://");
  const [username, setUsername] = useState("mtcl");
  const [password, setPassword] = useState("Cluemcluem123#");

  // ✅ 내선 범위 입력(여러 구간 가능)
  const [ranges, setRanges] = useState<RangeRow[]>([{ start: "", end: "" }]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 숫자 배열 → 정렬·중복제거
  const normalizeNumbers = (nums: number[]) =>
    Array.from(new Set(nums.filter((n) => Number.isInteger(n)))).sort((a, b) => a - b);

  // 숫자 배열 → 연속 구간으로 압축([{start,end},...])
  const compressToRanges = (nums: number[]): Array<{ start: number; end: number }> => {
    const res: Array<{ start: number; end: number }> = [];
    if (nums.length === 0) return res;
    let s = nums[0];
    let p = nums[0];
    for (let i = 1; i <= nums.length; i++) {
      const cur = nums[i];
      if (cur === p + 1) {
        p = cur;
        continue;
      }
      // 구간 종료
      res.push({ start: s, end: p });
      if (cur != null) {
        s = cur;
        p = cur;
      }
    }
    return res;
  };

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

  // 디버그 bat 다운로드
  async function downloadDebugBat() {
    window.location.href = "/api/chrome-debug-bat";
  }

  // ✅ Import 양식(XLSX) 다운로드: ‘내선번호’만 필수, 나머지 컬럼은 있어도 무시됨
  const downloadImportTemplate = () => {
    const headers = ["내선번호", "Type(무시됨)", "Entity(무시됨)", "Hunt(무시됨)", "Pick-up(무시됨)"];
    const example = [
      { "내선번호": 1000, "Type(무시됨)": "SIP extension", "Entity(무시됨)": "16", "Hunt(무시됨)": "6200", "Pick-up(무시됨)": "sales" },
      { "내선번호": 1001, "Type(무시됨)": "", "Entity(무시됨)": "", "Hunt(무시됨)": "", "Pick-up(무시됨)": "" },
      { "내선번호": 1002, "Type(무시됨)": "", "Entity(무시됨)": "", "Hunt(무시됨)": "", "Pick-up(무시됨)": "" },
      { "내선번호": 1010, "Type(무시됨)": "", "Entity(무시됨)": "", "Hunt(무시됨)": "", "Pick-up(무시됨)": "" },
    ];
    const ws = XLSX.utils.json_to_sheet(example, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "delete_import");
    XLSX.writeFile(wb, "user_deleter_import_template.xlsx");
  };

  // ✅ XLSX Import: ‘내선번호’만 사용해서 연속구간으로 압축 후 폼에 추가
  const importFromExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // ‘내선번호’만 추출 → 숫자만 → 정렬+중복제거
      const nums = normalizeNumbers(
        json.map((r) => Number(r["내선번호"])).filter((n) => Number.isFinite(n))
      );

      if (nums.length === 0) {
        alert("엑셀에서 유효한 ‘내선번호’를 찾지 못했습니다.");
        e.target.value = "";
        return;
      }

      // 연속 구간으로 압축
      const zipped = compressToRanges(nums);

      // 기존 빈 행 제거 + 새 구간 추가
      setRanges((old) => {
        const keep = old.filter(
          (r) => r.start?.toString().trim() !== "" && r.end?.toString().trim() !== ""
        );
        const appended = zipped.map((z) => ({ start: String(z.start), end: String(z.end) }));
        return [...keep, ...appended];
      });

      // 파일 인풋 리셋(같은 파일 재업로드 허용)
      e.target.value = "";
    } catch (err: any) {
      console.error(err);
      alert(`엑셀 처리 중 오류: ${err?.message || err}`);
    }
  };

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

      // 폼의 범위들을 확장해서 개별 번호 목록으로
      const extList: number[] = [];
      for (const row of ranges) {
        const s = toInt(row.start);
        const e = toInt(row.end);
        if (s === undefined || e === undefined) continue; // 빈 행 무시
        const [from, to] = s <= e ? [s, e] : [e, s];
        for (let n = from; n <= to; n++) extList.push(n);
      }

      if (extList.length === 0) {
        throw new Error("삭제할 내선번호가 없습니다. (빈 줄은 무시됩니다)");
      }

      // 정렬 + 중복 제거
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

      {/* 상단 고정: 디버그 bat + 템플릿 + Import + IP/ID/PW */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "white",
          padding: "10px 8px",
          borderBottom: "1px solid #e5e7eb",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={downloadDebugBat} className="border px-3 py-2 rounded bg-gray-50">
            실행 전 크롬을 디버그모드로 실행시키기(필수)
          </button>

          <button onClick={downloadImportTemplate} className="border px-3 py-2 rounded">
            Import 양식 다운로드 (XLSX)
          </button>

          {/* ✅ Import 버튼 */}
          <label className="border px-3 py-2 rounded cursor-pointer bg-gray-50">
            Import
            <input type="file" accept=".xlsx,.xls" hidden onChange={importFromExcel} />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
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
        </div>
      </div>

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
