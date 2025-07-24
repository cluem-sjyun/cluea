'use client';

import { auth } from '../../firebase'; // 상대경로 꼭 맞추기!
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginButton() {
  const router = useRouter();

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email || "";
      if (email.endsWith("@cluem.com")) {
        router.push("/main");
      } else {
        alert("cluem.com 도메인 이메일만 로그인할 수 있습니다.");
      }
    } catch (error) {
      let msg = "알 수 없는 오류";
      if (error instanceof Error) {
        msg = error.message;
      }
      alert("로그인 실패: " + msg);
    }
  };

  return (
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
  );
}
