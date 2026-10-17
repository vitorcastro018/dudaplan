/**
 * Guarda no IndexedDB as fatias da gravação em andamento. Se a aba cair, o
 * celular travar ou o navegador matar a página, o que já foi gravado dá para
 * recuperar na próxima visita à reunião. Todas as funções engolem erros:
 * IndexedDB pode estar indisponível (aba anônima, cota) e a gravação em si não
 * pode depender dele.
 */

const DB_NAME = "dudaplan-recordings";
const DB_VERSION = 1;
const CHUNKS = "chunks";
const META = "meta";

export type SavedRecording = {
  chunks: Blob[];
  mimeType: string;
  elapsedMs: number;
};

type ChunkRecord = { meetingId: string; blob: Blob };
type MetaRecord = { meetingId: string; mimeType: string; elapsedMs: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const chunks = db.createObjectStore(CHUNKS, { autoIncrement: true });
      chunks.createIndex("meetingId", "meetingId");
      db.createObjectStore(META, { keyPath: "meetingId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChunk(
  meetingId: string,
  blob: Blob,
  mimeType: string,
  elapsedMs: number,
): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([CHUNKS, META], "readwrite");
    tx.objectStore(CHUNKS).add({ meetingId, blob } satisfies ChunkRecord);
    tx.objectStore(META).put({ meetingId, mimeType, elapsedMs } satisfies MetaRecord);
    await done(tx);
    db.close();
  } catch {
    // Sem persistência a gravação segue normal, só perde a rede de segurança.
  }
}

export async function loadRecording(meetingId: string): Promise<SavedRecording | null> {
  try {
    const db = await openDb();
    const tx = db.transaction([CHUNKS, META], "readonly");
    const [records, meta] = await Promise.all([
      asPromise(tx.objectStore(CHUNKS).index("meetingId").getAll(meetingId)) as Promise<
        ChunkRecord[]
      >,
      asPromise(tx.objectStore(META).get(meetingId)) as Promise<MetaRecord | undefined>,
    ]);
    db.close();
    if (!meta || records.length === 0) return null;
    return {
      chunks: records.map((r) => r.blob),
      mimeType: meta.mimeType,
      elapsedMs: meta.elapsedMs,
    };
  } catch {
    return null;
  }
}

export async function clearRecording(meetingId: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([CHUNKS, META], "readwrite");
    const chunks = tx.objectStore(CHUNKS);
    const cursorRequest = chunks.index("meetingId").openKeyCursor(IDBKeyRange.only(meetingId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      chunks.delete(cursor.primaryKey);
      cursor.continue();
    };
    tx.objectStore(META).delete(meetingId);
    await done(tx);
    db.close();
  } catch {
    // ver saveChunk
  }
}
