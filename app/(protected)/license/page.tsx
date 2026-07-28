'use client';

import { useMemo, useState } from 'react';
import styles from './page.module.css';

type LicensePayload = {
  version: number;
  mac: string;
  licenseCount: number;
  issuedAt: string;
  scope: string;
};

type IssuedLicense = LicensePayload & {
  hash: string;
  signature: string;
};

const LICENSE_SECRET = 'cluem-license-signing-v1';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeMac(mac: string): string {
  return mac.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default function LicensePage() {
  const [mac, setMac] = useState('');
  const [licenseCount, setLicenseCount] = useState('100');
  const [status, setStatus] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [issuedLicense, setIssuedLicense] = useState<IssuedLicense | null>(null);

  const recommendedCount = useMemo(() => 100, []);

  const handleGenerate = async () => {
    const trimmedMac = mac.trim();
    const normalizedMac = normalizeMac(trimmedMac);
    const qty = Number(licenseCount);

    if (!trimmedMac || !normalizedMac) {
      setStatus('MAC 주소를 입력해 주세요.');
      return;
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      setStatus('라이선스 수량은 1 이상이어야 합니다.');
      return;
    }

    try {
      const payload: LicensePayload = {
        version: 1,
        mac: normalizedMac,
        licenseCount: qty,
        issuedAt: new Date().toISOString(),
        scope: 'cluem_web',
      };

      const encoder = new TextEncoder();
      const payloadJson = JSON.stringify(payload);
      const secretBytes = encoder.encode(LICENSE_SECRET);
      const key = await crypto.subtle.importKey(
        'raw',
        secretBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadJson));
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payloadJson));

      const issued: IssuedLicense = {
        ...payload,
        hash: arrayBufferToHex(hashBuffer),
        signature: arrayBufferToHex(signatureBuffer),
      };

      const blob = new Blob([JSON.stringify(issued, null, 2)], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
      setDownloadUrl(objectUrl);
      setIssuedLicense(issued);
      setStatus(`라이선스 파일이 생성되었습니다. (${qty}개)`);
    } catch (error) {
      console.error(error);
      setStatus('라이선스 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `cluem-license-${mac.replace(/[^a-z0-9]/gi, '-') || 'license'}.lic`;
    anchor.click();
  };

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <div className={styles.head}>
          <div>
            <p className={styles.eyebrow}>License issuance</p>
            <h1 className={styles.title}>클루엠 라이선스 발급</h1>
          </div>
          <span className={styles.badge}>클루엠 웹 연동</span>
        </div>

        <p className={styles.description}>
          MAC 주소와 라이선스 수량을 입력하면 검증에 사용할 파일을 바로 내려받을 수 있습니다.
          권장 수량은 현재 상태 페이지 기준으로 미리 채워집니다.
        </p>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>MAC 주소</span>
            <input
              value={mac}
              onChange={(event) => setMac(event.target.value)}
              placeholder="예: 00-11-22-33-44-55"
            />
          </label>

          <label className={styles.field}>
            <span>라이선스 수량</span>
            <input
              type="number"
              min="1"
              step="1"
              value={licenseCount}
              onChange={(event) => setLicenseCount(event.target.value)}
            />
          </label>
        </div>

        <div className={styles.helperRow}>
          <span className={styles.helperText}>권장 수량: {recommendedCount}개</span>
          <button type="button" className={styles.button} onClick={() => setLicenseCount(String(recommendedCount))}>
            권장 수량 적용
          </button>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={handleGenerate}>
            라이선스 파일 생성
          </button>
          <button type="button" className={styles.secondaryButton} onClick={handleDownload} disabled={!downloadUrl}>
            다운로드
          </button>
        </div>

        {status ? <p className={styles.status}>{status}</p> : null}

        {issuedLicense ? (
          <div className={styles.previewBox}>
            <h2>발급 미리보기</h2>
            <pre>{JSON.stringify(issuedLicense, null, 2)}</pre>
          </div>
        ) : null}
      </section>
    </div>
  );
}
