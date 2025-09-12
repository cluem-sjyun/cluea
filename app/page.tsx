// app/page.tsx
'use client';

import LoginButton from "./components/LoginButton";

export default function LoginPage() {
  return (
    <>
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#f5f6fa",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <LoginButton />
        <p style={{ color: "#555", fontSize: "14px" }}>
          cluem 이메일로만 로그인이 가능합니다(env 적용필요)
        </p>
      </div>
    </>
  );
}
