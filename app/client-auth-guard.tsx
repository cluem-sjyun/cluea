// app/client-auth-guard.tsx
"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

export default function ClientAuthGuard({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoading(false);

      // 1) 로그인 안 됐거나, 2) 도메인 검증(@cluem.com) 실패 → 루트로 리다이렉트
      if (
        (!user || !user.email?.endsWith("@cluem.com")) &&
        pathname !== "/"          // 루트(/)는 예외
      ) {
        router.replace("/");
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  // 인증 상태 로딩 중에는 빈 화면 또는 스피너 보여주기
  if (loading) return <div>로딩 중…</div>;

  return <>{children}</>;
}
