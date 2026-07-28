'use client';

import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@lib/firebase.client';
import styles from './page.module.css';

type Entitlement = { key: string; name: string; quantity: number; enabled: boolean; unit: string };
type LicensePayload = { version: number; licenseId: string; revision: number; mac: string; licenseCount: number; issuedAt: string; scope: string; licenses: Entitlement[] };
type IssuedLicense = LicensePayload & { hash: string; signature: string };
type LicenseRecord = { id: string; mac: string; status: 'active' | 'revoked'; revision: number; issuedAt: string; updatedAt: string; licenses: Entitlement[] };

const SECRET = 'cluem-license-signing-v1';
const OPTIONS = [
  ['ipt_users', '내선/DN', 'DN', 500], ['extension_users', '내선 사용자', '명', 300],
  ['pbx_users', 'PBX 사용자', '명', 200], ['all_recording_targets', '전수녹취 대상', '명', 500],
  ['select_recording_targets', '선택녹취 대상', '명', 500], ['hunt_groups', '헌트그룹', '개', 100],
  ['autodis', '자동 응답', '개', 500], ['ivr_dids', 'IVR 진입번호', '개', 200],
  ['ivr_flows', 'IVR 시나리오', '개', 100], ['blacklist', '블랙리스트', '건', 10000],
  ['callbacks', '콜백', '건', 10000], ['admins', '웹 관리자', '명', 50],
  ['active_calls', '동시 통화', '콜', 100],
] as const;

const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const normalizeMac = (value: string) => value.trim().toLowerCase().replace(/[^a-f0-9]/g, '');

async function sign(payload: LicensePayload): Promise<IssuedLicense> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', encoder.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [signature, hash] = await Promise.all([crypto.subtle.sign('HMAC', key, data), crypto.subtle.digest('SHA-256', data)]);
  return { ...payload, signature: hex(signature), hash: hex(hash) };
}

export default function LicensePage() {
  const defaults = Object.fromEntries(OPTIONS.map(([key, , , qty]) => [key, String(qty)]));
  const [mac, setMac] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>(defaults);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ ipt_users: true });
  const [editing, setEditing] = useState<LicenseRecord | null>(null);
  const [records, setRecords] = useState<LicenseRecord[]>([]);
  const [issued, setIssued] = useState<IssuedLicense | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await getDocs(query(collection(db, 'licenses'), orderBy('updatedAt', 'desc')));
    setRecords(result.docs.map((snapshot) => {
      const data = snapshot.data();
      return { id: snapshot.id, mac: String(data.mac ?? ''), status: data.status === 'revoked' ? 'revoked' : 'active', revision: Number(data.revision ?? 1), issuedAt: String(data.issuedAt ?? ''), updatedAt: String(data.updatedAt ?? data.issuedAt ?? ''), licenses: Array.isArray(data.licenses) ? data.licenses : [] };
    }));
  }, []);

  useEffect(() => { load().catch(() => setMessage('이력을 불러오지 못했습니다. Firestore 권한을 확인해 주세요.')); }, [load]);

  const reset = () => { setMac(''); setQuantities(defaults); setEnabled({ ipt_users: true }); setEditing(null); };
  const save = async () => {
    const normalizedMac = normalizeMac(mac);
    const licenses: Entitlement[] = OPTIONS.filter(([key]) => enabled[key]).map(([key, name, unit]) => ({ key, name, unit, enabled: true, quantity: Number(quantities[key]) }));
    if (normalizedMac.length !== 12) return setMessage('MAC 주소를 12자리 16진수로 입력해 주세요.');
    if (!licenses.length || licenses.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) return setMessage('라이선스를 선택하고 수량을 1 이상 입력해 주세요.');
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const licenseId = editing?.id ?? crypto.randomUUID();
      const revision = editing ? editing.revision + 1 : 1;
      const file = await sign({ version: 2, licenseId, revision, mac: normalizedMac, licenseCount: Math.max(...licenses.map((item) => item.quantity)), issuedAt: now, scope: 'cluem_web', licenses });
      const ref = doc(db, 'licenses', licenseId);
      const actor = auth.currentUser?.email ?? 'unknown';
      await setDoc(ref, { mac: normalizedMac, status: 'active', revision, issuedAt: editing?.issuedAt ?? now, updatedAt: now, licenses, latestHash: file.hash, updatedBy: actor, serverUpdatedAt: serverTimestamp() });
      await addDoc(collection(ref, 'events'), { type: editing ? 'changed' : 'issued', revision, occurredAt: now, actor, mac: normalizedMac, licenses, hash: file.hash, serverOccurredAt: serverTimestamp() });
      setIssued(file); setMessage(editing ? `revision ${revision}으로 변경했습니다.` : '라이선스를 발급했습니다.'); reset(); await load();
    } catch (error) { console.error(error); setMessage('저장하지 못했습니다. Firestore 권한을 확인해 주세요.'); } finally { setBusy(false); }
  };
  const edit = (record: LicenseRecord) => {
    setEditing(record); setMac(record.mac); setEnabled(Object.fromEntries(record.licenses.map((item) => [item.key, true])));
    setQuantities({ ...defaults, ...Object.fromEntries(record.licenses.map((item) => [item.key, String(item.quantity)])) }); setIssued(null); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const revoke = async (record: LicenseRecord) => {
    if (!confirm(`${record.mac} 라이선스를 폐기하시겠습니까?`)) return;
    setBusy(true);
    try {
      const now = new Date().toISOString(); const actor = auth.currentUser?.email ?? 'unknown'; const ref = doc(db, 'licenses', record.id);
      await setDoc(ref, { status: 'revoked', revokedAt: now, updatedAt: now, updatedBy: actor, serverUpdatedAt: serverTimestamp() }, { merge: true });
      await addDoc(collection(ref, 'events'), { type: 'revoked', revision: record.revision, occurredAt: now, actor, mac: record.mac, licenses: record.licenses, serverOccurredAt: serverTimestamp() });
      setMessage('라이선스를 폐기했습니다.'); await load();
    } finally { setBusy(false); }
  };
  const download = () => {
    if (!issued) return; const url = URL.createObjectURL(new Blob([JSON.stringify(issued, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cluem-license-${issued.mac}-r${issued.revision}.lic`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className={styles.page}>
    <section className={styles.card}>
      <div className={styles.head}><div><p className={styles.eyebrow}>License management</p><h1 className={styles.title}>{editing ? '라이선스 변경' : '라이선스 발급'}</h1></div><span className={styles.badge}>{editing ? `revision ${editing.revision + 1}` : '신규'}</span></div>
      <label className={styles.field}><span>MAC 주소</span><input value={mac} onChange={(e) => setMac(e.target.value)} placeholder="00-11-22-33-44-55" /></label>
      <div className={styles.entitlementGrid}>{OPTIONS.map(([key, name, unit]) => <label className={`${styles.entitlement} ${enabled[key] ? styles.entitlementActive : ''}`} key={key}><span><input type="checkbox" checked={Boolean(enabled[key])} onChange={(e) => setEnabled((old) => ({ ...old, [key]: e.target.checked }))} /> {name}</span><span><input type="number" min="1" disabled={!enabled[key]} value={quantities[key]} onChange={(e) => setQuantities((old) => ({ ...old, [key]: e.target.value }))} /> {unit}</span></label>)}</div>
      <div className={styles.actions}><button className={styles.primaryButton} onClick={save} disabled={busy}>{busy ? '처리 중...' : editing ? '변경 파일 생성' : '발급 파일 생성'}</button>{editing && <button className={styles.secondaryButton} onClick={reset}>취소</button>}<button className={styles.secondaryButton} onClick={download} disabled={!issued}>.lic 다운로드</button></div>
      {message && <p className={styles.status}>{message}</p>}
    </section>
    <section className={styles.card}>
      <div className={styles.head}><div><p className={styles.eyebrow}>Audit history</p><h2 className={styles.title}>발급·변경·폐기 현황</h2></div><span className={styles.badge}>{records.length}건</span></div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>MAC</th><th>상태</th><th>Rev.</th><th>라이선스</th><th>최근 변경</th><th>관리</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><code>{record.mac}</code></td><td><span className={record.status === 'active' ? styles.active : styles.revoked}>{record.status === 'active' ? '활성' : '폐기'}</span></td><td>{record.revision}</td><td>{record.licenses.map((item) => `${item.name} ${item.quantity}${item.unit}`).join(', ')}</td><td>{new Date(record.updatedAt).toLocaleString('ko-KR')}</td><td>{record.status === 'active' ? <span className={styles.rowActions}><button onClick={() => edit(record)}>변경</button><button className={styles.dangerButton} onClick={() => revoke(record)}>폐기</button></span> : '-'}</td></tr>)}{!records.length && <tr><td colSpan={6}>저장된 라이선스가 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}