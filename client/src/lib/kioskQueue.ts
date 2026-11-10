// File d'attente des pointages de la tablette (wifi instable).
//
// Chaque appui devient un événement { eventId, residentId, action, occurredAt }.
// La tablette l'envoie au serveur ; si le réseau ne répond pas (coupure, délai
// dépassé, serveur indisponible, session expirée), l'événement est rangé dans
// IndexedDB avec son heure réelle et renvoyé plus tard, dans l'ordre. Le serveur
// reconnaît eventId : un envoi répété (réponse perdue) n'est appliqué qu'une fois.

export type KioskAction = "checkin" | "checkout";

// « Mon espace » ouvert depuis la tablette (sessionStorage) : l'espace résident
// affiche le retour au pointage et y revient tout seul après 5 s sans action.
export const FROM_KIOSK_KEY = "fromKiosk";

export type KioskEvent = {
  eventId: string;
  residentId: number;
  action: KioskAction;
  occurredAt: string; // ISO, heure de l'appui
  residentName: string; // pour l'affichage sur la tablette uniquement (non envoyé)
  createdAt: number;
};

export type KioskEventResult = {
  action: KioskAction;
  resident: { id: number; firstName: string; lastName: string };
  occurredAt: string;
  durationMinutes?: number;
  isOutOfPackage?: boolean;
  remainingHours?: number;
  remainingMinutes?: number;
};

export type SendOutcome =
  | { kind: "ok"; result: KioskEventResult }
  | { kind: "retry"; reason: "network" | "server" | "auth" | "busy"; detail?: string }
  | { kind: "rejected"; message: string };

export type KioskStatus = {
  online: boolean;
  pending: KioskEvent[];
  sending: boolean;
  authProblem: boolean; // session de la tablette expirée : les pointages restent en file
  problem: "network" | "server" | null; // raison du dernier échec (affichée par l'indicateur)
  problemDetail: string | null; // détail technique du dernier échec (diagnostic)
};

const SEND_TIMEOUT_MS = 8000;
const RETRY_INTERVAL_MS = 30000;

export function newEventId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Navigateurs anciens (randomUUID n'existe qu'en HTTPS récent)
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b: number) => b.toString(16).padStart(2, "0")).join("");
}

// ── Stockage : IndexedDB, sinon localStorage (navigateur sans IndexedDB) ──────

const DB_NAME = "atelier-pointage";
const STORE = "queue";
const LS_KEY = "kioskQueue";

let dbPromise: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "eventId" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function idbRequest<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    // Écriture confirmée seulement quand la transaction est validée sur l'appareil.
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const lsRead = (): KioskEvent[] => JSON.parse(localStorage.getItem(LS_KEY) || "[]");
const lsWrite = (items: KioskEvent[]) => localStorage.setItem(LS_KEY, JSON.stringify(items));

async function listQueued(): Promise<KioskEvent[]> {
  const db = await openDb();
  const items = db ? await idbRequest<KioskEvent[]>(db, "readonly", (s) => s.getAll()) : lsRead();
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

async function addQueued(ev: KioskEvent): Promise<void> {
  const db = await openDb();
  if (db) await idbRequest(db, "readwrite", (s) => s.put(ev));
  else lsWrite([...lsRead().filter((e) => e.eventId !== ev.eventId), ev]);
}

async function removeQueued(eventId: string): Promise<void> {
  const db = await openDb();
  if (db) await idbRequest(db, "readwrite", (s) => s.delete(eventId));
  else lsWrite(lsRead().filter((e) => e.eventId !== eventId));
}

// ── Envoi ─────────────────────────────────────────────────────────────────────

// Toujours borné : au-delà du délai (pas de réponse, ou réponse coupée en cours de
// route — redémarrage du serveur…), l'envoi est abandonné et le pointage reste en file.
export function sendKioskEvent(ev: KioskEvent): Promise<SendOutcome> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SendOutcome>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ kind: "retry", reason: "network", detail: `pas de réponse en ${SEND_TIMEOUT_MS / 1000} s` });
    }, SEND_TIMEOUT_MS);
  });
  return Promise.race([attemptSend(ev, controller.signal), timeout]).finally(() => clearTimeout(timer));
}

async function attemptSend(ev: KioskEvent, signal: AbortSignal): Promise<SendOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/trpc/attendances.recordKioskEvent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        json: { eventId: ev.eventId, residentId: ev.residentId, action: ev.action, occurredAt: ev.occurredAt },
      }),
      signal,
    });
  } catch (err) {
    // Pas de réseau, ou pas de réponse dans le délai : le pointage a peut-être été
    // reçu — le renvoi avec le même eventId ne créera pas de doublon.
    return { kind: "retry", reason: "network", detail: `réseau : ${(err as Error)?.message ?? err}` };
  }

  let body: any = null;
  try {
    body = await res.json(); // borné lui aussi par le délai (signal)
  } catch {
    // Réponse coupée, ou page d'erreur de l'hébergeur (serveur en redémarrage…)
    return { kind: "retry", reason: "server", detail: `réponse illisible (HTTP ${res.status})` };
  }
  if (res.ok) return { kind: "ok", result: body?.result?.data?.json as KioskEventResult };

  const code: string | undefined = body?.error?.json?.data?.code;
  const message: string = body?.error?.json?.message ?? "Pointage refusé";
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return { kind: "retry", reason: "auth" };
  if (code === "TIMEOUT") return { kind: "retry", reason: "busy" }; // même pointage en cours de traitement
  if (res.status >= 500) {
    console.error(`[Pointage] Erreur du serveur (${res.status}) pour ${ev.residentName} : ${message}`);
    return { kind: "retry", reason: "server", detail: `HTTP ${res.status} : ${message}` };
  }
  return { kind: "rejected", message };
}

// ── État partagé + renvoi automatique ─────────────────────────────────────────

let status: KioskStatus = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  pending: [],
  sending: false,
  authProblem: false,
  problem: null,
  problemDetail: null,
};
const listeners = new Set<(s: KioskStatus) => void>();
const sentListeners = new Set<(r: KioskEventResult, ev: KioskEvent) => void>();

function setStatus(patch: Partial<KioskStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l(status));
}

export function subscribeKioskStatus(listener: (s: KioskStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

// Pointage de la file finalement enregistré par le serveur.
export function onQueuedEventSent(listener: (r: KioskEventResult, ev: KioskEvent) => void): () => void {
  sentListeners.add(listener);
  return () => sentListeners.delete(listener);
}

export function noteOutcome(outcome: SendOutcome) {
  if (outcome.kind === "ok" || outcome.kind === "rejected") setStatus({ online: true, authProblem: false, problem: null, problemDetail: null });
  else if (outcome.reason === "auth") setStatus({ online: true, authProblem: true });
  else if (outcome.reason === "network") setStatus({ online: false, problem: "network", problemDetail: outcome.detail ?? null });
  else if (outcome.reason === "server") setStatus({ online: false, problem: "server", problemDetail: outcome.detail ?? null });
}

export async function refreshPending(): Promise<KioskEvent[]> {
  const pending = await listQueued();
  setStatus({ pending });
  return pending;
}

// Range le pointage sur la tablette. Ne résout qu'une fois l'écriture confirmée.
export async function enqueueKioskEvent(ev: KioskEvent): Promise<void> {
  await addQueued(ev);
  await refreshPending();
}

let flushing: Promise<void> | null = null;
let flushStartedAt = 0;
// Garde-fou : un renvoi qui n'a pas abouti au bout de ce délai est considéré comme
// bloqué et n'empêche plus d'en relancer un (le serveur ignore les doublons).
const FLUSH_STALL_MS = 45000;

// Renvoie la file dans l'ordre ; s'arrête au premier pointage qui ne passe pas
// encore (pour ne jamais envoyer un départ avant son arrivée).
export function flushKioskQueue(): Promise<void> {
  if (flushing && Date.now() - flushStartedAt > FLUSH_STALL_MS) {
    console.warn("[Pointage] Renvoi bloqué : relancé");
    flushing = null;
  }
  if (!flushing) {
    flushStartedAt = Date.now();
    const current = (async () => {
      const pending = await refreshPending();
      if (pending.length === 0) return;
      setStatus({ sending: true });
      // Un pointage qui échoue côté serveur ne bloque que son résident (ordre arrivée →
      // départ préservé pour lui) ; les autres résidents continuent de partir. Sans
      // réseau, session expirée ou serveur occupé : on arrête tout et on réessaie plus tard.
      const blockedResidents = new Set<number>();
      try {
        for (const ev of pending) {
          if (blockedResidents.has(ev.residentId)) continue;
          const outcome = await sendKioskEvent(ev);
          noteOutcome(outcome);
          if (outcome.kind === "retry" && outcome.reason === "server") {
            blockedResidents.add(ev.residentId);
            continue;
          }
          if (outcome.kind === "retry") break;
          await removeQueued(ev.eventId);
          if (outcome.kind === "ok") sentListeners.forEach((l) => l(outcome.result, ev));
          else console.warn(`[Pointage] Pointage en attente refusé par le serveur (${ev.residentName}) : ${outcome.message}`);
          await refreshPending();
        }
      } finally {
        setStatus({ sending: false });
      }
    })().finally(() => {
      if (flushing === current) flushing = null;
    });
    flushing = current;
  }
  return flushing;
}

// À lancer une fois sur la page de pointage : renvoi au retour du réseau, toutes
// les 30 s, et tout de suite (pointages restés en file avant un rechargement).
export function startKioskAutoFlush(): () => void {
  const onOnline = () => void flushKioskQueue();
  const onOffline = () => setStatus({ online: false });
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  const timer = setInterval(() => void flushKioskQueue(), RETRY_INTERVAL_MS);
  void flushKioskQueue();
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    clearInterval(timer);
  };
}
