export interface OfflineBundleRecord<T = unknown> {
  key: string;
  data: T;
  savedAt: string;
}

const DB_NAME = "neyo-offline";
const DB_VERSION = 2;
const STORE = "bundleCache";

function openBundleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openBundleDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }));
}

export async function saveBundle<T>(key: string, data: T): Promise<OfflineBundleRecord<T>> {
  const item = { key, data, savedAt: new Date().toISOString() };
  await tx("readwrite", (s) => s.put(item));
  window.dispatchEvent(new Event("neyo:bundle-cache-changed"));
  return item;
}

export async function readBundle<T = unknown>(key: string): Promise<OfflineBundleRecord<T> | null> {
  if (typeof indexedDB === "undefined") return null;
  const row = await tx<OfflineBundleRecord<T> | undefined>("readonly", (s) => s.get(key));
  return row ?? null;
}

export async function estimateBundleSizeMb(key = "school-core"): Promise<number> {
  const row = await readBundle(key);
  if (!row) return 0;
  const bytes = new Blob([JSON.stringify(row.data)]).size;
  return Math.max(0.1, Math.round((bytes / 1024 / 1024) * 10) / 10);
}

export async function clearBundle(key = "school-core") {
  await tx("readwrite", (s) => s.delete(key));
  window.dispatchEvent(new Event("neyo:bundle-cache-changed"));
}
