"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type SetType = { value: string; label: string };
type JobRow = {
  startExt: string;
  endExt: string;
  entity: string;
  setTypeValue: string;
  huntGroup: string;
  pickupGroup: string;
};

export default function UserCreatorPage() {
  const setTypeOptions: SetType[] = useMemo(
    () => [
      { value: "UA_VVLE", label: "4001" },
      { value: "UA_VVLE_8", label: "4003" },
      { value: "UA_VVLE_3G", label: "4004" },
      { value: "UA_VVLE_3G_TSC", label: "4004 & TSC DECT" },
      { value: "UA_VVLE_3G_IP", label: "4004 & TSC IP" },
      { value: "UA_VLE_3G", label: "4010" },
      { value: "UA_VLE_3G_TSC", label: "4010 & TSC DECT" },
      { value: "UA_VLE_3G_IP", label: "4010 & TSC IP" },
      { value: "UA_VLE", label: "4011" },
      { value: "UA_LE", label: "4012" },
      { value: "NOE_A", label: "4019" },
      { value: "UA_LE_3G", label: "4020" },
      { value: "UA_LE_3G_TSC", label: "4021 (4020 & TSC DECT)" },
      { value: "UA_LE_3G_IP", label: "4022 (4020 & TSC IP)" },
      { value: "UA_MR1", label: "4023" },
      { value: "NOE_B", label: "4029" },
      { value: "UA_MR2", label: "4034" },
      { value: "UA_MR2_3G", label: "4035T" },
      { value: "UA_MR2_3G_TSC", label: "4036 (4035 & TSC DECT)" },
      { value: "UA_MR2_3G_IP", label: "4037 (4035 & TSC IP)" },
      { value: "NOE_C", label: "4039" },
      { value: "UA_HE", label: "4040" },
      { value: "UA_DECT_2G", label: "4074/Shell" },
      { value: "UA_VLE_CORDLESS", label: "4075" },
      { value: "BG_OPUS", label: "4302" },
      { value: "MG_OPUS", label: "4304" },
      { value: "HG_OPUS", label: "4321" },
      { value: "VPS_4610", label: "4610 (VPS No CLIP)" },
      { value: "VPS_4620", label: "4620 (VPS + CLIP)" },
      { value: "NOE_B_8019s", label: "8019s" },
      { value: "NOE_B_8029", label: "8029" },
      { value: "NOE_C_8039", label: "8039" },
      { value: "NOE_B_IP_ALE20", label: "ALE-20" },
      { value: "NOE_B_IP_ALE20H", label: "ALE-20h IP" },
      { value: "NOE_B_ALE20H", label: "ALE-20h TDM" },
      { value: "NOE_C_COLOR_IP_ALE30", label: "ALE-30" },
      { value: "NOE_C_COLOR_IP_ALE300", label: "ALE-300" },
      { value: "NOE_C_COLOR_IP_ALE30H", label: "ALE-30h IP" },
      { value: "NOE_C_ALE30H", label: "ALE-30h TDM" },
      { value: "NOE_C_COLOR_IP_ALE400", label: "ALE-400" },
      { value: "NOE_C_COLOR_IP_ALE500", label: "ALE-500" },
      { value: "ANALOG", label: "ANALOG" },
      { value: "Z_CLICK_PHONE", label: "ANALOG with 4980" },
      { value: "GAP_ENHANCED", label: "GAP +" },
      { value: "GAP_HANDSET", label: "GAP Handset" },
      { value: "IPT_4008", label: "IPTouch 4008" },
      { value: "NOE_A_IP", label: "IPTouch 4018" },
      { value: "NOE_B_IP", label: "IPTouch 4028" },
      { value: "NOE_C_IP", label: "IPTouch 4038" },
      { value: "NOE_C_Color_IP", label: "IPTouch 4068" },
      { value: "NOE_B_IP_8008", label: "IPTouch 8008" },
      { value: "NOE_B_IP_8018", label: "IPTouch 8018" },
      { value: "NOE_B_IP_8028", label: "IPTouch 8028" },
      { value: "NOE_B_IP_8028s", label: "IPTouch 8028s" },
      { value: "NOE_C_IP_8038", label: "IPTouch 8038" },
      { value: "NOE_B_IP_8058s", label: "IPTouch 8058s" },
      { value: "NOE_C_COLOR_IP_8068", label: "IPTouch 8068" },
      { value: "NOE_C_COLOR_IP_8068s", label: "IPTouch 8068s" },
      { value: "NOE_C_COLOR_IP_8078s", label: "IPTouch 8078s" },
      { value: "NOE_C_COLOR_IP_8082", label: "IPTouch 8082" },
      { value: "NOE_C_COLOR_IP_8088", label: "IPTouch 8088" },
      { value: "UA_LOOP", label: "Loop Station" },
      { value: "MIPT_300", label: "Mobile IPTouch" },
      { value: "PC_MultiMedia2", label: "MULTIMEDIA PC 2" },
      { value: "Remote_Extension", label: "Remote extension" },
      { value: "S0_Terminal", label: "S0 Set" },
      { value: "Extern_Station", label: "SIP device" },
      { value: "SIP_Extension", label: "SIP extension" }, // ✅ 라벨-밸류 일치(엑셀 라벨용)
      { value: "UA_VIRTUAL", label: "UA VIRTUAL (4035 VIRTUAL)" },
    ],
    []
  );

  // 상단 고정 공통
  const [ip, setIp] = useState("https://");
  const [username, setUsername] = useState("mtcl");
  const [password, setPassword] = useState("Cluemcluem123#");

  // 묶음 상태 (초기 한 줄은 빈값)
  const [rows, setRows] = useState<JobRow[]>([
    { startExt: "", endExt: "", entity: "", setTypeValue: "SIP_Extension", huntGroup: "", pickupGroup: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 라벨(엑셀 텍스트) -> value 매핑 (없으면 SIP_Extension 기본값)
  function typeLabelToValue(labelText: string, options: { value: string; label: string }[], fallback = "SIP_Extension") {
    const norm = (s: string) => (s ?? "").toLowerCase().trim();
    const hit = options.find(o => norm(o.label) === norm(labelText));
    return hit?.value || fallback;
  }

  const addRow = (afterIdx?: number) =>
    setRows((prev) => {
      const next = [...prev];
      const insertAt = typeof afterIdx === "number" ? afterIdx + 1 : next.length;
      next.splice(insertAt, 0, { startExt: "", endExt: "", entity: "", setTypeValue: "SIP_Extension", huntGroup: "", pickupGroup: "" });
      return next;
    });

  const removeRow = (idx: number) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const updateRow = <K extends keyof JobRow>(idx: number, key: K, value: JobRow[K]) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

  // 템플릿 다운로드 (XLSX)
  const downloadImportTemplate = () => {
    const headers = ["내선번호", "Type", "Entity", "Hunt", "Pick-up"];
    const example = [
      // 예시: 동일 속성 + 연번 → 한 묶음으로 병합될 수 있도록
      { "내선번호": 7000, "Type": "SIP extension", "Entity": "16", "Hunt": "6200", "Pick-up": "sales_pickup" },
      { "내선번호": 7001, "Type": "SIP extension", "Entity": "16", "Hunt": "6200", "Pick-up": "sales_pickup" },
      { "내선번호": 7002, "Type": "SIP extension", "Entity": "16", "Hunt": "6200", "Pick-up": "sales_pickup" },
      // 속성 다르게
      { "내선번호": 7100, "Type": "SIP extension", "Entity": "17", "Hunt": "",     "Pick-up": "" },
      { "내선번호": 7101, "Type": "SIP extension", "Entity": "17", "Hunt": "",     "Pick-up": "" },
    ];

    const ws = XLSX.utils.json_to_sheet(example, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "import");
    XLSX.writeFile(wb, "user_creator_import_template.xlsx");
  };

  // XLSX Import: 라벨을 value로 매핑, 연번+동일속성 병합 → rows 뒤에 추가
  const importFromExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      // 1) 파싱 + 라벨 → value 매핑 (없으면 SIP_Extension)
      const parsed = json
        .map((r) => ({
          ext: Number(r["내선번호"]),
          typeValue: typeLabelToValue(String(r["Type"]), setTypeOptions, "SIP_Extension"),
          entity: String(r["Entity"]).trim(),
          hunt: String(r["Hunt"]).trim(),
          pickup: String(r["Pick-up"]).trim(),
        }))
        .filter((r) => Number.isInteger(r.ext))
        .sort((a, b) => a.ext - b.ext);

      if (parsed.length === 0) {
        alert("엑셀에서 유효한 내선번호를 찾지 못했습니다.");
        e.target.value = "";
        return;
      }

      // 2) 연번 + 동일 속성 병합
      const merged: JobRow[] = [];
      let start = parsed[0].ext;
      let prev = parsed[0];

      for (let i = 1; i <= parsed.length; i++) {
        const cur = parsed[i];
        const isSameGroup =
          cur &&
          cur.ext === prev.ext + 1 &&
          cur.typeValue === prev.typeValue &&
          String(cur.entity) === String(prev.entity) &&
          String(cur.hunt) === String(prev.hunt) &&
          String(cur.pickup) === String(prev.pickup);

        if (isSameGroup) {
          prev = cur;
          continue;
        }

        // 그룹 종료 → 묶음 push
        merged.push({
          startExt: String(start),
          endExt: String(prev.ext),
          entity: prev.entity,
          setTypeValue: prev.typeValue,
          huntGroup: prev.hunt,
          pickupGroup: prev.pickup,
        });

        // 다음 그룹 시작
        if (cur) {
          start = cur.ext;
          prev = cur;
        }
      }

      // 3) 기존 rows 중 "내선번호 비어있는 행"은 제거하고, 병합된 묶음 뒤에 추가
      setRows((old) => {
        const keep = old.filter(
          (r) => r.startExt?.toString().trim() !== "" && r.endExt?.toString().trim() !== ""
        );
        return [...keep, ...merged];
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
      if (!ip || !ip.startsWith("https://")) throw new Error("IP/URL은 https://로 시작해야 합니다.");

      // 유효한 묶음만 취합 + setTypeValue가 옵션에 없으면 기본값 보정
      const jobs = rows
        .map((r) => {
          const s = Number(r.startExt);
          const e = Number(r.endExt);
          if (!Number.isInteger(s) || !Number.isInteger(e)) return null;

          // setTypeValue 정합성(옵션 존재 여부 체크 → 없으면 SIP_Extension로 보정)
          const validValues = new Set(setTypeOptions.map((o) => o.value));
          const safeTypeValue = validValues.has(r.setTypeValue) ? r.setTypeValue : "SIP_Extension";
          const sel = setTypeOptions.find((o) => o.value === safeTypeValue);

          return {
            startExt: Math.min(s, e),
            endExt: Math.max(s, e),
            entity: r.entity?.trim() || "",
            setTypeValue: safeTypeValue,
            setTypeText: sel?.label || "SIP extension",
            huntGroup: r.huntGroup?.trim() || "",
            pickupGroup: r.pickupGroup?.trim() || "",
          };
        })
        .filter(Boolean);

      if (jobs.length === 0) throw new Error("유효한 묶음이 없습니다. 시작/끝 내선번호를 입력하거나 Import 하세요.");

      const res = await fetch("/api/user-creator-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, username, password, jobs }),
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

  // 디버그 bat(유지)
  const downloadDebugBat = () => {
    window.location.href = "/api/chrome-debug-bat";
  };

  return (
    <main style={{ padding: 16, display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>User Creator</h1>

      {/* 상단 고정 바: IP/ID/PW + Import/Template */}
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
            <input className="border p-2 rounded" value={username} onChange={(e) => setUsername(e.target.value)} />
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

      {/* 묶음 입력 패널 */}
      <div className="border rounded p-3" style={{ display: "grid", gap: 12 }}>
        {rows.map((row, idx) => (
          <div key={idx} className="border rounded p-3" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>시작 내선번호</span>
                <input
                  type="number"
                  className="border p-2 rounded"
                  value={row.startExt}
                  onChange={(e) => updateRow(idx, "startExt", e.target.value)}
                  placeholder="예: 1001"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>끝 내선번호</span>
                <input
                  type="number"
                  className="border p-2 rounded"
                  value={row.endExt}
                  onChange={(e) => updateRow(idx, "endExt", e.target.value)}
                  placeholder="예: 1050"
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span>엔티티 번호(선택)</span>
              <input
                className="border p-2 rounded"
                value={row.entity}
                onChange={(e) => updateRow(idx, "entity", e.target.value)}
                placeholder="예: 16 (미입력 가능)"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Set Type</span>
              <select
                className="border p-2 rounded"
                value={setTypeOptions.some(o => o.value === row.setTypeValue) ? row.setTypeValue : "SIP_Extension"}
                onChange={(e) => updateRow(idx, "setTypeValue", e.target.value)}
              >
                {setTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <small style={{ color: "#6b7280" }}>
                엑셀의 Type은 <b>라벨</b>(예: <code>SIP extension</code>)로 입력하세요. 매칭되지 않으면 자동으로 <b>SIP extension</b>이 선택됩니다.
              </small>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>헌트그룹번호(선택)</span>
                <input
                  className="border p-2 rounded"
                  value={row.huntGroup}
                  onChange={(e) => updateRow(idx, "huntGroup", e.target.value)}
                  placeholder="예: 6200"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>픽업그룹번호(선택)</span>
                <input
                  className="border p-2 rounded"
                  value={row.pickupGroup}
                  onChange={(e) => updateRow(idx, "pickupGroup", e.target.value)}
                  placeholder="예: sales_pickup"
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => addRow(idx)} className="border px-3 py-2 rounded" title="아래에 묶음 추가">
                + 묶음
              </button>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="border px-3 py-2 rounded"
                title="이 묶음 삭제"
                disabled={rows.length <= 1}
              >
                − 묶음
              </button>
            </div>
          </div>
        ))}

      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={loading} className="border px-4 py-2 rounded">
          {loading ? "실행 중..." : "생성 실행"}
        </button>
        {loading && (
          <button
            onClick={async () => {
              await fetch("/api/user-creator-stop", { method: "POST" });
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
