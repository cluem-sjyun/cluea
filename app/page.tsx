// app/page.tsx
'use client';

import LoginButton from "./components/LoginButton";

export default function LoginPage() {
  return (
    <>
      <div style={{
        minHeight: "100dvh",
        display: "flex", justifyContent: "center", alignItems: "center",
        background: "#f5f6fa"
      }}>
        <LoginButton />
      </div>
      <div>게스트 로그인</div>
    </>
  );
}
