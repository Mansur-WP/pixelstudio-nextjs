/**
 * offline-db.ts — Lightweight IndexedDB wrapper for offline sync queue
 *
 * Stores pending API operations when the user is offline so they can be
 * replayed once connectivity is restored.
 */

const DB_NAME    = "pixelstudio-offline";
const DB_VERSION = 1;
const STORE_NAME = "sync-queue";

export type SyncStatus = "pending" | "syncing" | "done" | "error";

export interface SyncEntry {
  id:        number;
  type:      string;
  payload:   unknown;
  status:    SyncStatus;
  error?:    string;
  createdAt: number;
  syncedAt?: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function addSyncEntry(type: string, payload: unknown): Promise<number> {
  const db    = await openDb();
  const entry: Omit<SyncEntry, "id"> = { type, payload, status: "pending", createdAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror   = () => reject(req.error);
  });
}

export async function getPendingEntries(): Promise<SyncEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, "readonly");
    const req   = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () =>
      resolve((req.result as SyncEntry[]).filter(e => e.status === "pending"));
    req.onerror = () => reject(req.error);
  });
}

export async function patchSyncEntry(id: number, patch: Partial<SyncEntry>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const get   = store.get(id);
    get.onsuccess = () => {
      const updated = { ...get.result, ...patch };
      const put     = store.put(updated);
      put.onsuccess = () => resolve();
      put.onerror   = () => reject(put.error);
    };
    get.onerror = () => reject(get.error);
  });
}

export async function clearDoneEntries(): Promise<void> {
  const db = await openDb();
  const all: SyncEntry[] = await new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as SyncEntry[]);
    req.onerror   = () => reject(req.error);
  });
  const done = all.filter(e => e.status === "done");
  if (done.length === 0) return;
  const db2 = await openDb();
  await Promise.all(done.map(e => new Promise<void>((resolve, reject) => {
    const tx  = db2.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(e.id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  })));
}

export async function putSyncEntry(
  entryOrType: string | { id?: string | number; type: string; payload: unknown; localData?: Record<string, unknown>; status?: string; createdAt?: number },
  payload?: unknown
): Promise<number> {
  if (typeof entryOrType === "string") {
    return addSyncEntry(entryOrType, payload);
  }
  return addSyncEntry(entryOrType.type, entryOrType.payload);
}

export async function countByStatus(status: SyncStatus): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () =>
      resolve((req.result as SyncEntry[]).filter(e => e.status === status).length);
    req.onerror = () => reject(req.error);
  });
}
