// app/shell.tsx
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import ClientAuthGuard from "./client-auth-guard";
import Topbar from "./topbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/";

  // 로그인 루트(/)는 보호/상단바 제외
  if (isLogin) {
    return <>{children}</>;
  }

  // 그 외 전역 보호 + 전역 상단바
  return (
    <ClientAuthGuard>
      <Topbar />
      {/* 상단바 고정 높이만큼 여백 */}
      <main style={{ paddingTop: 56 }}>{children}</main>
    </ClientAuthGuard>
  );
}
