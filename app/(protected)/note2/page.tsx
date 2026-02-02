// app/note2/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@lib/firebase.client";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import styles from "./page.module.css";

type SharedDoc = {
  content?: string;
  updatedAt?: Timestamp;
  updatedBy?: string | null;
};

export default function Note2() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastServerUpdatedAt, setLastServerUpdatedAt] = useState<number | null>(
    null
  );

  // ✅ 여기만 note2용으로 변경
  const sharedDocRef = useMemo(() => doc(db, "shared", "mainText2"), []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email?.endsWith("@cluem.com")) {
        router.replace("/");
        return;
      }

      const snap = await getDoc(sharedDocRef);
      if (snap.exists()) {
        const data = snap.data() as SharedDoc;
        setText(data.content ?? "");
        const millis = data.updatedAt?.toMillis();
        if (millis) setLastServerUpdatedAt(millis);
      }
      setLoading(false);

      const unsubDoc = onSnapshot(sharedDocRef, (s) => {
        if (!s.exists()) return;
        const d = s.data() as SharedDoc;
        const serverMillis = d.updatedAt?.toMillis();
        if (
          serverMillis &&
          (!lastServerUpdatedAt || serverMillis > lastServerUpdatedAt)
        ) {
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
    <div className={`${styles.page} page-fill`}>
      <h1 className={styles.title}>공동 메모장 2</h1>

      <div className={styles.editorWrap}>
        <textarea
          className={styles.editor}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="여기에 자유롭게 작성하세요. 저장하면 모두에게 보입니다."
        />
      </div>

      <div className={styles.actions}>
        <button onClick={handleSave} disabled={saving} className={styles.button}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>

      <p className={styles.help}>
        실시간 동기화: 다른 사용자가 저장하면 이 화면에도 곧바로 반영됩니다.
      </p>
    </div>
  );
}
