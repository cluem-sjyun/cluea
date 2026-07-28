'use client';

import { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@lib/firebase.client';
import styles from './page.module.css';

type Entitlement = { key: string; name: string; quantity: number; enabled: boolean; unit: string };
type LicensePayload = { version: number; licenseId: string; revision: number; siteName: string; mac: string; licenseCount: number; issuedAt: string; scope: string; licenses: Entitlement[] };
type IssuedLicense = LicensePayload & { hash: string; signature: string };
type LicenseRecord = { id: string; siteName: string; mac: string; revision: number; issuedAt: string; licenses: Entitlement[] };

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
const TOGGLES = [['call_monitoring', '통화 모니터링'], ['tts', 'TTS'], ['department_sync', '부서 동기화']] as const;
const FEATURE_DEFAULTS = { call_monitoring: false, tts: false, department_sync: false };
const DEFAULT_QUANTITIES = Object.fromEntries(OPTIONS.map(([key, , , qty]) => [key, String(qty)]));

const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const normalizeMac = (value: string) => value.trim().toLowerCase().replace(/[^a-f0-9]/g, '');
const formatMacInput = (value: string) => {
  const hexOnly = normalizeMac(value).slice(0, 12);
  return hexOnly.match(/.{1,2}/g)?.join(':') ?? '';
};

async function sign(payload: LicensePayload): Promise<IssuedLicense> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', encoder.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [signature, hash] = await Promise.all([crypto.subtle.sign('HMAC', key, data), crypto.subtle.digest('SHA-256', data)]);
  return { ...payload, signature: hex(signature), hash: hex(hash) };
}

export default function LicensePage() {
  const [siteName, setSiteName] = useState('');
  const [mac, setMac] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>(DEFAULT_QUANTITIES);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ ipt_users: true });
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>(FEATURE_DEFAULTS);
  const [editing, setEditing] = useState<LicenseRecord | null>(null);
  const [issued, setIssued] = useState<IssuedLicense | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId) return;
    getDoc(doc(db, 'licenses', editId)).then((snapshot) => {
      if (!snapshot.exists() || snapshot.data().status === 'revoked') return setMessage('변경할 활성 라이센스를 찾을 수 없습니다.');
      const data = snapshot.data();
      const licenses: Entitlement[] = Array.isArray(data.licenses) ? data.licenses : [];
      const record = { id: snapshot.id, siteName: String(data.siteName ?? ''), mac: String(data.mac ?? ''), revision: Number(data.revision ?? 1), issuedAt: String(data.issuedAt ?? ''), licenses };
      setEditing(record); setSiteName(record.siteName); setMac(formatMacInput(record.mac));
      setEnabled(Object.fromEntries(licenses.filter((item) => !TOGGLES.some(([key]) => key === item.key)).map((item) => [item.key, true])));
      setFeatureStates({ ...FEATURE_DEFAULTS, ...Object.fromEntries(licenses.filter((item) => TOGGLES.some(([key]) => key === item.key)).map((item) => [item.key, item.enabled])) });
      setQuantities({ ...DEFAULT_QUANTITIES, ...Object.fromEntries(licenses.map((item) => [item.key, String(item.quantity)])) });
    }).catch(() => setMessage('라이센스 정보를 불러오지 못했습니다.'));
  }, []);

  const reset = () => { setSiteName(''); setMac(''); setQuantities(DEFAULT_QUANTITIES); setEnabled({ ipt_users: true }); setFeatureStates(FEATURE_DEFAULTS); setEditing(null); history.replaceState(null, '', '/license'); };
  const save = async () => {
    const normalizedSiteName = siteName.trim(); const normalizedMac = normalizeMac(mac);
    const capacity: Entitlement[] = OPTIONS.filter(([key]) => enabled[key]).map(([key, name, unit]) => ({ key, name, unit, enabled: true, quantity: Number(quantities[key]) }));
    const features: Entitlement[] = TOGGLES.map(([key, name]) => ({ key, name, unit: '상태', enabled: Boolean(featureStates[key]), quantity: 1 }));
    const licenses = [...capacity, ...features];
    if (!normalizedSiteName) return setMessage('사이트명을 입력해 주세요.');
    if (normalizedMac.length !== 12) return setMessage('MAC 주소를 12자리 16진수로 입력해 주세요.');
    if (!capacity.length || capacity.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) return setMessage('라이센스를 선택하고 수량을 1 이상 입력해 주세요.');
    setBusy(true);
    try {
      const now = new Date().toISOString(); const licenseId = editing?.id ?? crypto.randomUUID(); const revision = editing ? editing.revision + 1 : 1;
      const file = await sign({ version: 3, licenseId, revision, siteName: normalizedSiteName, mac: normalizedMac, licenseCount: Math.max(...capacity.map((item) => item.quantity)), issuedAt: now, scope: 'cluem_web', licenses });
      const ref = doc(db, 'licenses', licenseId); const actor = auth.currentUser?.email ?? 'unknown';
      await setDoc(ref, { siteName: normalizedSiteName, mac: normalizedMac, status: 'active', revision, issuedAt: editing?.issuedAt ?? now, updatedAt: now, licenses, latestHash: file.hash, updatedBy: actor, serverUpdatedAt: serverTimestamp() });
      await addDoc(collection(ref, 'events'), { type: editing ? 'changed' : 'issued', revision, occurredAt: now, actor, siteName: normalizedSiteName, mac: normalizedMac, licenses, hash: file.hash, serverOccurredAt: serverTimestamp() });
      setIssued(file); setMessage(editing ? `revision ${revision}으로 변경했습니다.` : '라이센스를 발급했습니다.'); reset();
    } catch (error) { console.error(error); setMessage('저장하지 못했습니다. Firestore 권한을 확인해 주세요.'); } finally { setBusy(false); }
  };
  const download = () => { if (!issued) return; const url = URL.createObjectURL(new Blob([JSON.stringify(issued, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `cluem-license-${issued.mac}-r${issued.revision}.lic`; a.click(); URL.revokeObjectURL(url); };

  return <div className={styles.page}><section className={styles.card}>
    <div className={styles.head}><div><p className={styles.eyebrow}>License management</p><h1 className={styles.title}>{editing ? '라이센스 변경' : '라이센스 발급'}</h1></div><a className={styles.historyLink} href="/license/history">발급·변경·폐기 현황</a></div>
    <label className={styles.field}><span>사이트명</span><input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></label>
    <label className={styles.field}><span>MAC 주소</span><input value={mac} onChange={(e) => setMac(formatMacInput(e.target.value))} maxLength={17} /></label>
    <div className={styles.entitlementGrid}>{OPTIONS.map(([key, name, unit]) => <label className={`${styles.entitlement} ${enabled[key] ? styles.entitlementActive : ''}`} key={key}><span><input type="checkbox" checked={Boolean(enabled[key])} onChange={(e) => setEnabled((old) => ({ ...old, [key]: e.target.checked }))} /> {name}</span><span><input type="number" min="1" disabled={!enabled[key]} value={quantities[key]} onChange={(e) => setQuantities((old) => ({ ...old, [key]: e.target.value }))} /> {unit}</span></label>)}</div>
    <div className={styles.featureGrid}>{TOGGLES.map(([key, name]) => <div className={styles.featureCard} key={key}><strong>{name}</strong><div className={styles.toggleButtons}><button type="button" className={featureStates[key] ? styles.toggleActive : ''} onClick={() => setFeatureStates((old) => ({ ...old, [key]: true }))}>사용</button><button type="button" className={!featureStates[key] ? styles.toggleInactive : ''} onClick={() => setFeatureStates((old) => ({ ...old, [key]: false }))}>미사용</button></div></div>)}</div>
    <div className={styles.actions}><button className={styles.primaryButton} onClick={save} disabled={busy}>{busy ? '처리 중...' : editing ? '변경 파일 생성' : '발급 파일 생성'}</button>{editing && <button className={styles.secondaryButton} onClick={reset}>변경 취소</button>}<button className={styles.secondaryButton} onClick={download} disabled={!issued}>.lic 다운로드</button></div>
    {message && <p className={styles.status}>{message}</p>}
  </section></div>;
}