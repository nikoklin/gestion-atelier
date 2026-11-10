/**
 * Pointages de la tablette (dont ceux gardés hors connexion puis renvoyés) :
 * heure réelle, sans doublon, refus mémorisés, rattrapage après la clôture
 * automatique de 22 h, limite hors forfait, accès réservé à la tablette connectée.
 * Résidents de test 990150-990152 sans e-mail (aucun envoi), nettoyés à la fin.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances, kioskEvents } from "../drizzle/schema";
import { appRouter } from "./routers";

const A = 990150; // pointages normaux
const B = 990151; // rattrapage après clôture automatique
const C = 990152; // limite hors forfait
const MIN = 60000;
const tablet = appRouter.createCaller({ req: {} as any, res: {} as any, user: { id: 1, role: "admin" } } as any);
const visitor = appRouter.createCaller({ req: {} as any, res: {} as any, user: null } as any);

let seq = 0;
const eventId = () => `test-kiosk-${Date.now()}-${++seq}`;
// Heure de référence unique, à la seconde (comme la base) : les durées attendues
// ne dépendent pas des quelques millisecondes écoulées entre deux appels.
const base = Math.floor(Date.now() / 1000) * 1000;
const at = (msAgo: number) => new Date(base - msAgo).toISOString();
const send = (id: string, residentId: number, action: "checkin" | "checkout", occurredAt: string) =>
  tablet.attendances.recordKioskEvent({ eventId: id, residentId, action, occurredAt });

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  for (const id of [A, B, C]) {
    await database.delete(kioskEvents).where(eq(kioskEvents.residentId, id));
    await database.delete(attendances).where(eq(attendances.residentId, id));
    await database.delete(packages).where(eq(packages.residentId, id));
    await database.delete(residents).where(eq(residents.id, id));
  }
}

describe.skipIf(!process.env.DATABASE_URL)("Pointages de la tablette", () => {
  beforeAll(async () => {
    await cleanup();
    const t = Date.now();
    for (const [id, name] of [[A, "Arrivée"], [B, "Rattrapage"], [C, "Limite"]] as const) {
      await db.createResident({ id, firstName: "TEST", lastName: name, email: "", isActive: true } as any);
      await db.createPackage({ id: id * 10, residentId: id, packageType: "custom_1", totalHours: 900, usedHours: 0,
        startDate: new Date(t - 10 * 86400000), endDate: new Date(t + 40 * 86400000), isActive: true, status: "active" } as any);
    }
  });
  afterAll(cleanup);

  it("arrivée puis départ hors connexion, renvoyés plus tard : enregistrés aux heures réelles", async () => {
    const inId = eventId();
    const arrival = await send(inId, A, "checkin", at(120 * MIN));
    expect(arrival.action).toBe("checkin");
    const departure = await send(eventId(), A, "checkout", at(30 * MIN));
    expect(departure.action).toBe("checkout");
    expect(departure.durationMinutes).toBe(90);

    const list = await db.getAttendancesByResidentId(A);
    expect(list).toHaveLength(1);
    expect(list[0].durationMinutes).toBe(90);
  });

  it("même pointage renvoyé (réponse perdue) : appliqué une seule fois, même réponse", async () => {
    const id = eventId();
    const first = await send(id, A, "checkin", at(10 * MIN));
    const again = await send(id, A, "checkin", at(10 * MIN));
    expect(again).toEqual(first);
    expect((await db.getAttendancesByResidentId(A)).filter((a) => !a.checkOutTime)).toHaveLength(1);

    const outId = eventId();
    const out1 = await send(outId, A, "checkout", at(1 * MIN));
    const out2 = await send(outId, A, "checkout", at(1 * MIN));
    expect(out2).toEqual(out1);
    expect(await db.getAttendancesByResidentId(A)).toHaveLength(2);
  });

  it("refus métier mémorisé : un départ sans arrivée est refusé, et le même refus est renvoyé ensuite", async () => {
    const id = eventId();
    await expect(send(id, A, "checkout", at(1 * MIN))).rejects.toThrow(/pas de pointage d'arrivée en cours/);
    await expect(send(id, A, "checkout", at(1 * MIN))).rejects.toThrow(/pas de pointage d'arrivée en cours/);
  });

  it("heure dans le futur ou pointage de plus de 14 jours : refusés", async () => {
    await expect(send(eventId(), A, "checkin", new Date(Date.now() + 10 * MIN).toISOString())).rejects.toThrow(/futur/);
    await expect(send(eventId(), A, "checkin", at(15 * 86400000))).rejects.toThrow(/14 jours/);
  });

  it("même pointage en cours de traitement (deux envois simultanés) : « réessayer plus tard », rien d'appliqué", async () => {
    const id = eventId();
    const database = await getDb();
    await database!.insert(kioskEvents).values({ eventId: id, residentId: A, action: "checkin", occurredAt: new Date() });
    await expect(send(id, A, "checkin", at(0))).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("départ transmis après la clôture automatique de 22 h : vraie heure de départ, alerte retirée", async () => {
    // Arrivée il y a 10 h, clôturée d'office il y a 2 h (comme à 22 h), alerte posée.
    const checkIn = new Date(base - 10 * 60 * MIN);
    const autoClose = new Date(base - 2 * 60 * MIN);
    await db.createAttendance({ id: B * 10, residentId: B, packageId: B * 10, checkInTime: checkIn, checkOutTime: autoClose,
      durationMinutes: 480, attendanceType: "normal" } as any);
    await db.updateResident(B, { hasMissedCheckout: true, missedCheckoutAttendanceId: B * 10 });

    // Le résident était parti 5 h après son arrivée ; la tablette n'avait pas de réseau.
    const res = await send(eventId(), B, "checkout", new Date(checkIn.getTime() + 5 * 60 * MIN).toISOString());
    expect(res.durationMinutes).toBe(300);
    const att = (await db.getAttendanceById(B * 10))!;
    expect(att.durationMinutes).toBe(300);
    const r = (await db.getResidentById(B))!;
    expect(r.hasMissedCheckout).toBe(false);
    expect(r.missedCheckoutAttendanceId).toBeNull();
  });

  it("limite de 5 h hors forfait : arrivée en direct refusée, arrivée transmise en retard acceptée", async () => {
    await db.updateResident(C, { outOfPackageMinutes: 300 });
    await expect(send(eventId(), C, "checkin", at(0))).rejects.toThrow(/limite de 5h/);
    const late = await send(eventId(), C, "checkin", at(60 * MIN));
    expect(late.action).toBe("checkin");
  });

  it("résident supprimé depuis (pointage resté en file) : refus définitif, pas d'erreur serveur", async () => {
    await expect(send(eventId(), 990159, "checkin", at(5 * MIN))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sans session (pas la tablette connectée) : refusé", async () => {
    await expect(visitor.attendances.recordKioskEvent({ eventId: eventId(), residentId: A, action: "checkin", occurredAt: at(0) }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(visitor.attendances.kioskState()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("données de la tablette : liste et présents, sans e-mail ni téléphone", async () => {
    const state = await tablet.attendances.kioskState();
    const a = state.residents.find((r) => r.id === A);
    expect(a).toEqual({ id: A, firstName: "TEST", lastName: "Arrivée" });
    expect(state.openAttendances.some((o) => o.residentId === C)).toBe(true);
    expect(JSON.stringify(state)).not.toMatch(/"email"|"phone"/);
  });
});
