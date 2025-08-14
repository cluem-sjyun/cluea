// app/topbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/note1", label: "note1" },
  { href: "/note2", label: "note2" },
  { href: "/ex3",   label: "ex3"   },
  { href: "/ex4",   label: "ex4"   },
  { href: "/ex5",   label: "ex5"   },
];

export default function Topbar() {
  const pathname = usePathname();

  return (
    <header
      /* ★ fixed 제거: 그리드의 첫 번째 행에서 항상 보임 */
      style={{
        height: "var(--topbar-h)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        boxShadow: "0 1px 0 rgba(0,0,0,0.06)", // border-bottom 대신 사용 (1px 반올림 이슈 회피)
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
