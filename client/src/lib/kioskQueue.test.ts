/**
 * File d'attente des pointages de la tablette, sans navigateur : réseau simulé
 * (fetch) et stockage simulé (localStorage ; IndexedDB absent → repli prévu).
 * Le « serveur » simulé applique chaque eventId une seule fois, comme le vrai.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
};

type Mode = "ok" | "down" | "lostResponse" | "http500" | "unauth" | "busy" | "reject" | "hungBody" | "hungRequest";
let mode: Mode = "ok";
const applied: string[] = []; // eventId appliqués par le « serveur », dans l'ordre

globalThis.fetch = (async (_url: string, init: any) => {
  const ev = JSON.parse(init.body).json;
  if (mode === "down") throw new TypeError("Failed to fetch");
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const apply = () => {
    if (!applied.includes(ev.eventId)) applied.push(ev.eventId);
  };
  if (mode === "hungRequest") return new Promise(() => {}); // aucune réponse, jamais
  if (mode === "hungBody") {
    // Le serveur commence à répondre puis la connexion se fige (redémarrage pendant la réponse).
    return { ok: true, status: 200, json: () => new Promise(() => {}) } as unknown as Response;
  }
  switch (mode) {
    case "lostResponse":
      apply(); // reçu et enregistré… mais la réponse ne revient jamais
      throw new TypeError("Failed to fetch");
    case "http500":
      return new Response("<html>Bad Gateway</html>", { status: 502 });
    case "unauth":
      return reply(401, { error: { json: { message: "Please login", data: { code: "UNAUTHORIZED" } } } });
    case "busy":
      return reply(408, { error: { json: { message: "en cours", data: { code: "TIMEOUT" } } } });
    case "reject":
      return reply(400, { error: { json: { message: "Départ avant l'arrivée", data: { code: "BAD_REQUEST" } } } });
    default:
      apply();
      return reply(200, { result: { data: { json: { action: ev.action, resident: { id: ev.residentId, firstName: "T", lastName: "T" }, occurredAt: ev.occurredAt } } } });
  }
}) as any;

const q = await import("./kioskQueue");

let n = 0;
const event = (action: "checkin" | "checkout" = "checkin"): q.KioskEvent => ({
  eventId: `evt-${++n}`, residentId: 1, action, occurredAt: new Date(Date.now() - 60000).toISOString(),
  residentName: "Test", createdAt: Date.now() + n,
});

beforeEach(async () => {
  store.clear();
  applied.length = 0;
  mode = "ok";
  await q.refreshPending();
});

describe("Envoi d'un pointage", () => {
  it.each([
    ["ok", "ok"],
    ["down", "retry"],
    ["lostResponse", "retry"],
    ["http500", "retry"],
    ["unauth", "retry"],
    ["busy", "retry"],
    ["reject", "rejected"],
  ] as const)("réponse « %s » → %s", async (m, expected) => {
    mode = m;
    expect((await q.sendKioskEvent(event())).kind).toBe(expected);
  });
});

describe("File d'attente", () => {
  it("réseau coupé : les pointages restent en file ; au retour, envoyés dans l'ordre et retirés", async () => {
    mode = "down";
    const a = event("checkin"), b = event("checkout");
    await q.enqueueKioskEvent(a);
    await q.enqueueKioskEvent(b);
    await q.flushKioskQueue();
    expect((await q.refreshPending()).map((e) => e.eventId)).toEqual([a.eventId, b.eventId]);

    const sent: string[] = [];
    const off = q.onQueuedEventSent((_r, ev) => sent.push(ev.eventId));
    mode = "ok";
    await q.flushKioskQueue();
    off();
    expect(applied).toEqual([a.eventId, b.eventId]);
    expect(sent).toEqual([a.eventId, b.eventId]);
    expect(await q.refreshPending()).toHaveLength(0);
  });

  it("réponse perdue puis renvoi : le pointage n'est appliqué qu'une fois", async () => {
    const a = event();
    await q.enqueueKioskEvent(a);
    mode = "lostResponse";
    await q.flushKioskQueue(); // le serveur l'a reçu, la tablette ne le sait pas
    expect(await q.refreshPending()).toHaveLength(1);
    mode = "ok";
    await q.flushKioskQueue();
    expect(applied).toEqual([a.eventId]);
    expect(await q.refreshPending()).toHaveLength(0);
  });

  it("le premier pointage bloqué arrête l'envoi (jamais un départ avant son arrivée)", async () => {
    const a = event("checkin"), b = event("checkout");
    await q.enqueueKioskEvent(a);
    await q.enqueueKioskEvent(b);
    mode = "busy";
    await q.flushKioskQueue();
    expect(applied).toEqual([]);
    expect(await q.refreshPending()).toHaveLength(2);
  });

  it("session expirée : pointages gardés, indicateur « session expirée »", async () => {
    let status: q.KioskStatus | undefined;
    const off = q.subscribeKioskStatus((s) => (status = s));
    await q.enqueueKioskEvent(event());
    mode = "unauth";
    await q.flushKioskQueue();
    off();
    expect(status!.authProblem).toBe(true);
    expect(status!.pending).toHaveLength(1);
  });

  it("pointage refusé par le serveur : retiré de la file, les suivants partent", async () => {
    const bad = event("checkout"), good = event("checkin");
    await q.enqueueKioskEvent(bad);
    await q.enqueueKioskEvent(good);
    const fetchSpy = vi.fn();
    mode = "reject";
    // Premier envoi refusé, second accepté.
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: any) => {
      fetchSpy();
      mode = fetchSpy.mock.calls.length === 1 ? "reject" : "ok";
      return original(url, init);
    }) as any;
    await q.flushKioskQueue();
    globalThis.fetch = original;
    expect(applied).toEqual([good.eventId]);
    expect(await q.refreshPending()).toHaveLength(0);
  });

  it("état en ligne / hors ligne suivant le dernier envoi", async () => {
    let status: q.KioskStatus | undefined;
    const off = q.subscribeKioskStatus((s) => (status = s));
    q.noteOutcome({ kind: "retry", reason: "network" });
    expect(status!.online).toBe(false);
    q.noteOutcome({ kind: "ok", result: {} as any });
    expect(status!.online).toBe(true);
    off();
  });
});

describe("Envois bloqués (connexion figée)", () => {
  it.each(["hungBody", "hungRequest"] as const)("« %s » : abandonné au bout du délai, la file reste et repart ensuite", async (m) => {
    vi.useFakeTimers();
    try {
      const a = event(), b = event();
      await q.enqueueKioskEvent(a);
      await q.enqueueKioskEvent(b);
      mode = m;
      const flush = q.flushKioskQueue();
      await vi.advanceTimersByTimeAsync(9000);
      await flush; // ne reste pas bloqué
      expect(await q.refreshPending()).toHaveLength(2);

      mode = "ok";
      await q.flushKioskQueue();
      expect(applied).toEqual([a.eventId, b.eventId]);
      expect(await q.refreshPending()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
