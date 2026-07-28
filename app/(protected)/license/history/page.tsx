'use client';

import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@lib/firebase.client';
import styles from '../page.module.css';

type Entitlement = { key: string; name: string; quantity: number; enabled: boolean; unit: string };
type LicenseRecord = { id: string; siteName: string; mac: string; status: 'active' | 'revoked'; revision: number; updatedAt: string; licenses: Entitlement[] };
const TOGGLE_KEYS = ['call_monitoring', 'tts', 'department_sync'];

export default function LicenseHistoryPage() {
  const [records, setRecords] = useState<LicenseRecord[]>([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    const result = await getDocs(query(collection(db, 'licenses'), orderBy('updatedAt', 'desc')));
    setRecords(result.docs.map((snapshot) => {
      const data = snapshot.data();
      return { id: snapshot.id, siteName: String(data.siteName ?? ''), mac: String(data.mac ?? ''), status: data.status === 'revoked' ? 'revoked' : 'active', revision: Number(data.revision ?? 1), updatedAt: String(data.updatedAt ?? data.issuedAt ?? ''), licenses: Array.isArray(data.licenses) ? data.licenses : [] };
    }));
  }, []);

  useEffect(() => { load().catch(() => setMessage('이력을 불러오지 못했습니다. Firestore 권한을 확인해 주세요.')); }, [load]);

  const revoke = async (record: LicenseRecord) => {
    if (!confirm(`${record.siteName || record.mac} 라이센스를 폐기하시겠습니까?`)) return;
    setBusyId(record.id);
    try {
      const now = new Date().toISOString(); const actor = auth.currentUser?.email ?? 'unknown'; const ref = doc(db, 'licenses', record.id);
      await setDoc(ref, { status: 'revoked', revokedAt: now, updatedAt: now, updatedBy: actor, serverUpdatedAt: serverTimestamp() }, { merge: true });
      await addDoc(collection(ref, 'events'), { type: 'revoked', revision: record.revision, occurredAt: now, actor, siteName: record.siteName, mac: record.mac, licenses: record.licenses, serverOccurredAt: serverTimestamp() });
      setMessage('라이센스를 폐기했습니다.'); await load();
    } catch { setMessage('폐기 처리하지 못했습니다.'); } finally { setBusyId(''); }
  };

  const licenseSummary = (items: Entitlement[]) => items.map((item) => TOGGLE_KEYS.includes(item.key) ? `${item.name} ${item.enabled ? '사용' : '미사용'}` : `${item.name} ${item.quantity}${item.unit}`).join(', ');

  return <div className={styles.page}><section className={styles.card}>
    <div className={styles.head}><div><p className={styles.eyebrow}>Audit history</p><h1 className={styles.title}>발급·변경·폐기 현황</h1></div><a className={styles.historyLink} href="/license">신규 발급</a></div>
    {message && <p className={styles.status}>{message}</p>}
    <div className={styles.tableWrap}><table className={styles.table}>
      <thead><tr><th>사이트명</th><th>MAC</th><th>상태</th><th>Rev.</th><th>라이센스</th><th>최근 변경</th><th>관리</th></tr></thead>
      <tbody>{records.map((record) => <tr key={record.id}>
        <td>{record.siteName || '-'}</td><td><code>{record.mac}</code></td><td><span className={record.status === 'active' ? styles.active : styles.revoked}>{record.status === 'active' ? '활성' : '폐기'}</span></td><td>{record.revision}</td><td>{licenseSummary(record.licenses)}</td><td>{record.updatedAt ? new Date(record.updatedAt).toLocaleString('ko-KR') : '-'}</td>
        <td>{record.status === 'active' ? <span className={styles.rowActions}><a href={`/license?edit=${encodeURIComponent(record.id)}`}>변경</a><button className={styles.dangerButton} disabled={busyId === record.id} onClick={() => revoke(record)}>폐기</button></span> : '-'}</td>
      </tr>)}{!records.length && <tr><td colSpan={7} className={styles.empty}>저장된 라이센스가 없습니다.</td></tr>}</tbody>
    </table></div>
  </section></div>;
}