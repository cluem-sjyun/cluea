// app/main/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

export default function MainPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastServerUpdatedAt, setLastServerUpdatedAt] = useState<number | null>(null);

  // 모든 사용자가 함께 편집하는 단일 문서 (원하면 room 개념으로 확장)
  const sharedDocRef = useMemo(() => doc(db, "shared", "mainText"), []);

  // 로그인 확인 + 문서 구독
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email?.endsWith("@cluem.com")) {
        router.replace("/"); // 가드와 동일한 정책 유지
        return;
      }

      // 최초 로딩: 현재 서버 값 읽기
      const snap = await getDoc(sharedDocRef);
      if (snap.exists()) {
        const data = snap.data() as any;
        setText(data.content ?? "");
        if (data.updatedAt?.toMillis) {
          setLastServerUpdatedAt(data.updatedAt.toMillis());
        }
      }
      setLoading(false);

      // 실시간 구독
      const unsubDoc = onSnapshot(sharedDocRef, (s) => {
        if (!s.exists()) return;
        const d = s.data() as any;
        // 내가 로컬에서 편집 중이더라도 서버 값이 더 최신이면 반영
        const serverMillis = d.updatedAt?.toMillis?.();
        if (serverMillis && (!lastServerUpdatedAt || serverMillis > lastServerUpdatedAt)) {
          setText(d.content ?? "");
          setLastServerUpdatedAt(serverMillis);
        }
      });

      return () => unsubDoc();
    });

    return () => unsubAuth();
  }, [router, sharedDocRef, lastServerUpdatedAt]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = auth.currentUser;
      const payload = {
        content: text,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email ?? null,
      };

      const snap = await getDoc(sharedDocRef);
      if (snap.exists()) {
        await updateDoc(sharedDocRef, payload);
      } else {
        await setDoc(sharedDocRef, payload);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>로딩 중…</div>;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>공동 메모장</h1>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="여기에 자유롭게 작성하세요. 저장하면 모두에게 보입니다."
        style={{
          width: "100%",
          minHeight: 320,
          padding: 12,
          fontSize: 16,
          lineHeight: 1.5,
          border: "1px solid #ddd",
          borderRadius: 8,
          resize: "vertical",
          background: "#fff",
        }}
      />

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: saving ? "#ccc" : "#2f7cf6",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          {saving ? "저장 중…" : "저장"}
        </button>

        {/* 자동 저장 원하면 아래 주석을 참고해 throttle/debounce 로직 추가 */}
        {/* 예: useEffect로 text 변경 시 800ms 후 setDoc 호출 (lodash.debounce) */}
      </div>

      <p style={{ marginTop: 8, color: "#666" }}>
        실시간 동기화: 다른 사용자가 저장하면 이 화면에도 곧바로 반영됩니다.
      </p>
    </div>
  );
}
