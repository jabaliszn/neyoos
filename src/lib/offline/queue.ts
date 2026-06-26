/**
 * Offline action queue (Feature G.2). Stores POST actions in IndexedDB while
 * offline and replays them when back online. Each action carries an
 * idempotency key so a replay is safe even if the first attempt partly went
 * through. Browser-only (guards for SSR).
 */

export interface QueuedAction {
  id: string; // idempotency key (also IndexedDB key)
  url: string;
  body: unknown;
  label: string; // human label e.g. "Mark attendance — Form 2"
  createdAt: number;
}

const DB_NAME = "neyo-offline";
const STORE = "outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function enqueue(action: Omit<QueuedAction, "id" | "createdAt">): Promise<QueuedAction> {
  const item: QueuedAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(item));
  window.dispatchEvent(new Event("neyo:queue-changed"));
  return item;
}

export async function listQueued(): Promise<QueuedAction[]> {
  if (typeof indexedDB === "undefined") return [];
  const all = await tx<QueuedAction[]>("readonly", (s) => s.getAll());
  return (all ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function remove(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  window.dispatchEvent(new Event("neyo:queue-changed"));
}

export async function queueCount(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  return tx<number>("readonly", (s) => s.count());
}

/**
 * queuedPost — the helper write-features use. If online, POST immediately with
 * an Idempotency-Key. If offline (or the request fails), queue it for later.
 * Returns { queued: boolean }.
 */
export async function queuedPost(
  url: string,
  body: unknown,
  label: string
): Promise<{ queued: boolean; ok: boolean }> {
  const idempotencyKey = crypto.randomUUID();
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      });
      if (res.ok) return { queued: false, ok: true };
      // Server reachable but rejected — surface it (don't queue 4xx).
      if (res.status >= 400 && res.status < 500) return { queued: false, ok: false };
    } catch {
      /* network failed -> fall through to queue */
    }
  }
  await enqueue({ url, body, label });
  return { queued: true, ok: true };
}

/** Replay all queued actions. Removes each on success. Returns counts. */
export async function syncQueue(): Promise<{ sent: number; failed: number }> {
  const items = await listQueued();
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": item.id },
        body: JSON.stringify(item.body),
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // success OR permanent client error -> drop it (don't retry forever).
        await remove(item.id);
        if (res.ok) sent++;
        else failed++;
      } else {
        failed++; // 5xx -> keep for next sync
      }
    } catch {
      failed++; // offline again -> keep
      break;
    }
  }
  return { sent, failed };
}
