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
  Timestamp,
} from "firebase/firestore";
import {
  SharedDoc,
  sharedDocConverter,
} from "@/app/lib/firestoreTypes"; // ⬅️ 추가

export default function MainPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastServerUpdatedAt, setLastServerUpdatedAt] = useState<number | null>(null);

  const sharedDocRef = useMemo(
    () => doc(db, "shared", "mainText").withConverter(sharedDocConverter),
    []
  );

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email?.endsWith("@cluem.com")) {
        router.replace("/");
        return;
      }

      const snap = await getDoc(sharedDocRef);
      if (snap.exists()) {
        const data = snap.data(); // SharedDoc 타입
        setText(data.content ?? "");
        const ts = data.updatedAt;
        if (ts instanceof Timestamp) {
          setLastServerUpdatedAt(ts.toMillis());
        }
      }
      setLoading(false);

      const unsubDoc = onSnapshot(sharedDocRef, (s) => {
        if (!s.exists()) return;
        const d = s.data(); // SharedDoc 타입
        const ts = d.updatedAt;
        const serverMillis = ts instanceof Timestamp ? ts.toMillis() : undefined;

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
      const payload: SharedDoc = {
        content: text,
        // 서버에서 Timestamp로 셋팅됨(쓰기 시점엔 FieldValue지만 읽힐 땐 Timestamp)
        updatedBy: user?.email ?? null,
      };

      const snap = await getDoc(sharedDocRef);
      if (snap.exists()) {
        await updateDoc(sharedDocRef, {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(sharedDocRef, {
          ...payload,
          updatedAt: serverTimestamp(),
        });
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
      </div>

      <p style={{ marginTop: 8, color: "#666" }}>
        실시간 동기화: 다른 사용자가 저장하면 이 화면에도 곧바로 반영됩니다.
      </p>
    </div>
  );
}
