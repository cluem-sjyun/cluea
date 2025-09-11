// app/topbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/note1",       label: "Note1" },
  { href: "/note2",       label: "Note2" },
  { href: "/user-creator", label: "User Creator" },
  { href: "/user-deleter", label: "User Deleter" },
  { href: "/ex5",         label: "ex5" },
];

export default function Topbar() {
  const pathname = usePathname();

  return (
    <header
      style={{
        height: "var(--topbar-h)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
        background: "#fff",
        zIndex: 1,
      }}
    >
      <div style={{ fontWeight: 700 }}>ClueA</div>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: 8,
                fontWeight: active ? 700 : 500,
                background: active ? "#f3f4f6" : "transparent",
                display: "inline-block",
              }}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
