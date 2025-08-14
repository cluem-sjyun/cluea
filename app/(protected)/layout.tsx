// app/(protected)/layout.tsx
import React from "react";
import ClientAuthGuard from "../client-auth-guard";
import Topbar from "../topbar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientAuthGuard>
      <div className="app-shell">
        <Topbar />
        <main className="app-content">{children}</main>
      </div>
    </ClientAuthGuard>
  );
}
