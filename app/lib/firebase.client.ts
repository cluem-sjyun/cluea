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

// HMR 대비 전역 캐시
declare global {
  // 전역 보조 캐시 (declare global에서 var 사용은 TS 문법이고, eslint-disable 주석 불필요)
  var __FIREBASE_APP__: FirebaseApp | undefined;
  var __FIREBASE_AUTH__: Auth | undefined;
  var __FIREBASE_DB__: Firestore | undefined;
}

const app: FirebaseApp =
  globalThis.__FIREBASE_APP__ ??
  (globalThis.__FIREBASE_APP__ =
    getApps().length ? getApp() : initializeApp(firebaseConfig));

const auth: Auth =
  globalThis.__FIREBASE_AUTH__ ??
  (globalThis.__FIREBASE_AUTH__ = (() => {
    try {
      // resolver/persistence를 명시적으로 지정
      return initializeAuth(app, {
        persistence: [browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      // 이미 기본 Auth가 생성된 경우
      return getAuth(app);
    }
  })());

const db: Firestore =
  globalThis.__FIREBASE_DB__ ??
  (globalThis.__FIREBASE_DB__ = getFirestore(app));

export { app, auth, db };
