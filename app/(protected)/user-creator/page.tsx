"use client";

import { useMemo, useState } from "react";

type SetType = { value: string; label: string };

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
      { value: "SIP_Extension", label: "SIP extension" },
      { value: "UA_VIRTUAL", label: "UA VIRTUAL (4035 VIRTUAL)" },
    ],
    []
  );

  // 기본값/라벨 요구사항 반영
  const [ip, setIp] = useState("https://");                 // ✅ https:// 만 기본
  const [username, setUsername] = useState("mtcl");          // ✅ 기본값 mtcl
  const [password, setPassword] = useState("Cluemcluem123#"); // ✅ 기본값 표시
  const [startExt, setStartExt] = useState<string>("");      // ✅ 빈값으로 시작
  const [endExt, setEndExt] = useState<string>("");          // ✅ 빈값으로 시작
  const [entity, setEntity] = useState<string>("");          // 선택 사항
  const [setTypeValue, setSetTypeValue] = useState<string>("SIP_Extension");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<null | "ok" | "fail">(null);
  const [debugMsg, setDebugMsg] = useState<string>("");

  const [huntGroup, setHuntGroup] = useState<string>("");    // ✅ 헌트그룹(선택)
  const [pickupGroup, setPickupGroup] = useState<string>(""); // ✅ 픽업그룹(선택)

  const submit = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      if (!ip || !ip.startsWith("https://")) throw new Error("IP/URL은 https://로 시작해야 합니다.");
      const s = Number(startExt), e = Number(endExt);
      if (!Number.isInteger(s) || !Number.isInteger(e)) throw new Error("시작/끝 내선번호를 입력하세요.");

      const sel = setTypeOptions.find(o => o.value === setTypeValue);

      const res = await fetch("/api/user-creator-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip, username, password,
          startExt: s, endExt: e,
          entity,
          setTypeValue, setTypeText: sel?.label || "",
          huntGroup,           // ✅ 추가
          pickupGroup,         // ✅ 추가
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.stderr || data?.error || "실패");
      setResult(data);
    } catch (e: any) {
      setError(e?.message || "에러");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <main style={{ padding: 16, display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>User Creator</h1>

      {/* 디버그 모드 도우미 */}
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
        <input className="border p-2 rounded" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="https://192.168.x.x" />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>계정(기본값: mtcl)</span>
        <input className="border p-2 rounded" value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>비밀번호(기본값: C로 시작하는)</span>
        <input type="password" className="border p-2 rounded" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>시작 내선번호</span>
          <input
            type="number"
            className="border p-2 rounded"
            value={startExt}
            onChange={(e) => setStartExt(e.target.value)}
            placeholder="예: 1001"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>끝 내선번호</span>
          <input
            type="number"
            className="border p-2 rounded"
            value={endExt}
            onChange={(e) => setEndExt(e.target.value)}
            placeholder="예: 1050"
          />
        </label>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span>엔티티 번호(선택)</span>
        <input
          className="border p-2 rounded"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          placeholder="예: 16 (미입력 가능)"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Set Type</span>
        <select className="border p-2 rounded" value={setTypeValue} onChange={(e) => setSetTypeValue(e.target.value)}>
          {setTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <small style={{ color: "#6b7280" }}>
          셀렉트의 <strong>value</strong>는 DOM option의 value 속성, <strong>라벨</strong>은 화면 표시 텍스트입니다.
        </small>
      </label>

      {/* ✅ 신규: Facilities 탭 내 필드에 매핑될 선택 입력 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>헌트그룹번호(선택)</span>
          <input
            className="border p-2 rounded"
            value={huntGroup}
            onChange={(e) => setHuntGroup(e.target.value)}
            placeholder="예: 6200"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>픽업그룹번호(선택)</span>
          <input
            className="border p-2 rounded"
            value={pickupGroup}
            onChange={(e) => setPickupGroup(e.target.value)}
            placeholder="예: sales_pickup"
          />
        </label>
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
