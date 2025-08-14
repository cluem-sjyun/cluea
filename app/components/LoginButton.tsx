'use client';

import { auth } from '@lib/firebase.client';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export default function LoginButton() {
  const router = useRouter();
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);

    const provider = new GoogleAuthProvider();
    try {
      // 1) 우선 팝업
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email || '';
      if (email.endsWith('@cluem.com')) {
        router.push('/note1');
      } else {
        alert('cluem.com 도메인 이메일만 로그인할 수 있습니다.');
      }
    } catch (err: any) {
      // 2) 팝업 실패 케이스 → 리다이렉트 폴백
      const code = err?.code || '';
      const fallback =
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/internal-error'; // 드물게 내부 에러 시도 폴백

      if (fallback) {
        try {
          await signInWithRedirect(auth, provider);
          return; // 리다이렉트 진행
        } catch (e) {
          console.error(e);
          alert('로그인 실패(redirect): ' + (e as Error).message);
        }
      } else {
        console.error(err);
        alert('로그인 실패: ' + (err as Error).message);
      }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGoogleLogin}
      disabled={loading}
      style={{
        padding: '1rem 2rem',
        background: '#4285F4',
        color: '#fff',
        fontSize: '1.1rem',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 'bold',
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? '로그인 중…' : 'Google로 로그인'}
    </button>
  );
}
