'use client';

import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email || "";
      // cluem.com 이메일만 허용
      if (email.endsWith("@cluem.com")) {
        router.push("/main");
      } else {
        alert("cluem.com 도메인 이메일만 로그인할 수 있습니다.");
      }
    } catch (error) {
      alert("로그인 실패: " + (error as any).message);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#f5f6fa"
    }}>
      <button
        style={{
          padding: "1rem 2rem",
          background: "#4285F4",
          color: "#fff",
          fontSize: "1.1rem",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
        onClick={handleGoogleLogin}
      >
        Google로 로그인
      </button>
    </div>
  );
}
