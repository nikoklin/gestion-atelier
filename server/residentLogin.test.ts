/**
 * Connexion à l'espace résident par lien personnel (e-mail) : demande du lien,
 * ouverture (cookie de session), refus sans session, tablette admin, liens
 * expirés / falsifiés / d'un résident archivé. Brevo simulé (aucun envoi réel).
 * Résidents de test 990140-990141, nettoyés à la fin.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { getDb } from "./db";
import * as db from "./db";
import { residents, packages, attendances } from "../drizzle/schema";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { RESIDENT_COOKIE_NAME, signResidentSession, verifyResidentLink } from "./_core/residentSession";
import { ENV } from "./_core/env";

const A = 990140;
const B = 990141;
const EMAIL_A = "lien-test-a@example.invalid";

let mails: { to: string; subject: string; html: string }[] = [];
globalThis.fetch = (async (_url: string, init: any) => {
  const body = JSON.parse(init.body);
  mails.push({ to: body.to[0].email, subject: body.subject, html: body.htmlContent });
  return new Response("{}", { status: 201 });
}) as any;

type Cookie = { name: string; value: string; options: any };
function caller(ctx: { user?: any; residentId?: number | null } = {}) {
  const cookies: Cookie[] = [];
  const cleared: string[] = [];
  const res = {
    cookie: (name: string, value: string, options: any) => cookies.push({ name, value, options }),
    clearCookie: (name: string) => cleared.push(name),
  };
  const req = { protocol: "https", headers: {} };
  return { api: appRouter.createCaller({ req, res, user: ctx.user ?? null, residentId: ctx.residentId ?? null } as any), cookies, cleared };
}
const admin = { id: 1, role: "admin" };
const linkFrom = (html: string) => decodeURIComponent(html.match(/\/resident\/acces\?t=([^"&\s<]+)/)![1]);

async function cleanup() {
  const database = await getDb();
  if (!database) return;
  for (const id of [A, B]) {
    await database.delete(attendances).where(eq(attendances.residentId, id));
    await database.delete(packages).where(eq(packages.residentId, id));
    await database.delete(residents).where(eq(residents.id, id));
  }
}

describe.skipIf(!process.env.DATABASE_URL)("Connexion à l'espace résident par lien e-mail", () => {
  beforeAll(async () => {
    await cleanup();
    await db.createResident({ id: A, firstName: "Alice", lastName: "Lien", email: EMAIL_A, isActive: true } as any);
    await db.createResident({ id: B, firstName: "Bruno", lastName: "Autre", email: "lien-test-b@example.invalid", isActive: true } as any);
  });
  afterAll(cleanup);
  beforeEach(() => { mails = []; });

  it("adresse connue (majuscules et espaces tolérés) : un e-mail avec le lien personnel", async () => {
    const res = await caller().api.residentAuth.requestLoginLink({ email: "  LIEN-TEST-A@example.invalid " });
    expect(res).toEqual({ success: true });
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe(EMAIL_A);
    expect(mails[0].html).toContain("/resident/acces?t=");
    expect(await verifyResidentLink(linkFrom(mails[0].html))).toBe(A);
  });

  it("nouvelle demande dans les 2 minutes : même réponse, pas de second e-mail", async () => {
    expect(await caller().api.residentAuth.requestLoginLink({ email: EMAIL_A })).toEqual({ success: true });
    expect(mails).toHaveLength(0);
  });

  it("adresse inconnue : même réponse, aucun e-mail", async () => {
    expect(await caller().api.residentAuth.requestLoginLink({ email: "inconnu-990140@example.invalid" })).toEqual({ success: true });
    expect(mails).toHaveLength(0);
  });

  it("ouverture du lien : cookie de session résident posé (1 an, httpOnly), reconnu à la requête suivante", async () => {
    const { signResidentLink } = await import("./_core/residentSession");
    const c = caller();
    await c.api.residentAuth.redeemLink({ token: await signResidentLink(A) });
    expect(c.cookies).toHaveLength(1);
    expect(c.cookies[0].name).toBe(RESIDENT_COOKIE_NAME);
    expect(c.cookies[0].options.httpOnly).toBe(true);
    expect(c.cookies[0].options.maxAge).toBeGreaterThan(360 * 86400000);

    const ctx = await createContext({ req: { headers: { cookie: `${RESIDENT_COOKIE_NAME}=${c.cookies[0].value}` } }, res: {} } as any);
    expect(ctx.residentId).toBe(A);
  });

  it("lien falsifié, expiré, ou jeton de session utilisé comme lien : refusés", async () => {
    const api = caller().api;
    await expect(api.residentAuth.redeemLink({ token: "pas-un-jeton" })).rejects.toThrow(/expiré/);
    const expired = await new SignJWT({ residentId: A, kind: "resident_link" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(ENV.cookieSecret));
    await expect(api.residentAuth.redeemLink({ token: expired })).rejects.toThrow(/expiré/);
    await expect(api.residentAuth.redeemLink({ token: await signResidentSession(A) })).rejects.toThrow(/expiré/);
  });

  it("espace : sans session refusé ; connecté, toujours ses propres données même si un autre identifiant est envoyé", async () => {
    await expect(caller().api.residentAuth.getInfo({ residentId: A })).rejects.toThrow(/Connecte-toi/);
    const info = await caller({ residentId: A }).api.residentAuth.getInfo({ residentId: B });
    expect(info.resident.firstName).toBe("Alice");
  });

  it("tablette de l'atelier (admin connecté) : ouvre l'espace du résident choisi", async () => {
    const info = await caller({ user: admin }).api.residentAuth.getInfo({ residentId: B });
    expect(info.resident.firstName).toBe("Bruno");
  });

  it("ajout d'une séance sans session : refusé, rien n'est créé", async () => {
    const t = Date.now() - 86400000;
    await expect(caller().api.residentAuth.createManualSession({
      residentId: A, checkInTime: new Date(t).toISOString(), checkOutTime: new Date(t + 3600000).toISOString(),
    })).rejects.toThrow(/Connecte-toi/);
    expect(await db.getAttendancesByResidentId(A)).toHaveLength(0);
  });

  it("déconnexion : le cookie de session résident est effacé", async () => {
    const c = caller({ residentId: A });
    await c.api.residentAuth.logout();
    expect(c.cleared).toContain(RESIDENT_COOKIE_NAME);
  });

  it("résident archivé : son lien et sa session ne sont plus acceptés", async () => {
    const { signResidentLink } = await import("./_core/residentSession");
    const token = await signResidentLink(B);
    const session = await signResidentSession(B);
    await db.updateResident(B, { isDeleted: true });
    await expect(caller().api.residentAuth.redeemLink({ token })).rejects.toThrow(/expiré/);
    const ctx = await createContext({ req: { headers: { cookie: `${RESIDENT_COOKIE_NAME}=${session}` } }, res: {} } as any);
    expect(ctx.residentId).toBeNull();
  });
});
