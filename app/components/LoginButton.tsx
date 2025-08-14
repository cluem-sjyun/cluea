'use client';

import { auth } from '@lib/firebase.client';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
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
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email || '';
      if (email.endsWith('@cluem.com')) {
        router.push('/note1');
      } else {
        alert('cluem.com 도메인 이메일만 로그인할 수 있습니다.');
      }
    } catch (err: unknown) {
      // 타입 안전하게 코드/메시지 추출
      let code = '';
      let message = '알 수 없는 오류';
      if (err instanceof FirebaseError) {
        code = err.code;
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }

      const shouldRedirect =
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/internal-error';

      if (shouldRedirect) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (e) {
          const m = e instanceof Error ? e.message : '알 수 없는 오류';
          alert('로그인 실패(redirect): ' + m);
        }
      } else {
        alert('로그인 실패: ' + message);
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
