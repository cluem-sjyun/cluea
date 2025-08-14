// app/lib/firebase.client.ts
'use client';

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

declare global {
  // HMR 대비 전역 캐시
  // eslint-disable-next-line no-var
  var __FIREBASE_APP__: FirebaseApp | undefined;
  // eslint-disable-next-line no-var
  var __FIREBASE_AUTH__: Auth | undefined;
  // eslint-disable-next-line no-var
  var __FIREBASE_DB__: Firestore | undefined;
}

const app =
  globalThis.__FIREBASE_APP__ ??
  (globalThis.__FIREBASE_APP__ =
    getApps().length ? getApp() : initializeApp(firebaseConfig));

let auth =
  globalThis.__FIREBASE_AUTH__ ??
  (globalThis.__FIREBASE_AUTH__ = (() => {
    // 이미 어딘가에서 getAuth()로 초기화한 경우가 있을 수 있음 → try/catch
    try {
      // 권장: initializeAuth로 resolver/persistence를 명시
      return initializeAuth(app, {
        persistence: [browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      // 이미 기본 Auth가 만들어졌다면 여기로
      return getAuth(app);
    }
  })());

const db =
  globalThis.__FIREBASE_DB__ ??
  (globalThis.__FIREBASE_DB__ = getFirestore(app));

export { app, auth, db };
