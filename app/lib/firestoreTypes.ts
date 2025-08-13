// app/lib/firestoreTypes.ts
import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from "firebase/firestore";

export type SharedDoc = {
  content: string;
  updatedAt?: Timestamp;      // 읽을 때는 Timestamp
  updatedBy?: string | null;
};

export const sharedDocConverter: FirestoreDataConverter<SharedDoc> = {
  toFirestore(data: SharedDoc) {
    return data;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): SharedDoc {
    const d = snapshot.data(options);
    return {
      content: (d.content as string) ?? "",
      updatedAt: d.updatedAt as Timestamp | undefined,
      updatedBy: (d.updatedBy as string | null | undefined) ?? null,
    };
  },
};
