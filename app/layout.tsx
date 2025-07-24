// app/layout.tsx
import "./globals.css";
import ClientAuthGuard from "./client-auth-guard";

export const metadata = {
  title: "My ClueA App",
  description: "ClueA 전용 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {/* 로그인(루트) 페이지(/)만 제외하고 전역 보호 */}
        <ClientAuthGuard>
          {children}
        </ClientAuthGuard>
      </body>
    </html>
  );
}
