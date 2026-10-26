import { ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";
import { getPublicSiteUrl } from "./publicSiteUrl";

// Espace résident : pas de mot de passe. Le résident reçoit par e-mail un lien
// personnel signé (valable 7 jours) ; en l'ouvrant, son appareil reçoit un
// cookie de session signé (1 an), distinct de celui de l'admin. Les deux jetons
// portent un « kind » différent : l'un ne peut pas servir à la place de l'autre.
export const RESIDENT_COOKIE_NAME = "resident_session";
export const RESIDENT_LINK_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;

type Kind = "resident_session" | "resident_link";

const secret = () => new TextEncoder().encode(ENV.cookieSecret);

async function sign(residentId: number, kind: Kind, validityMs: number): Promise<string> {
  return new SignJWT({ residentId, kind })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + validityMs) / 1000))
    .sign(secret());
}

async function verify(token: string | undefined | null, kind: Kind): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.kind !== kind || typeof payload.residentId !== "number") return null;
    return payload.residentId;
  } catch {
    return null;
  }
}

export const signResidentSession = (residentId: number) => sign(residentId, "resident_session", ONE_YEAR_MS);
export const signResidentLink = (residentId: number) => sign(residentId, "resident_link", RESIDENT_LINK_VALIDITY_MS);
export const verifyResidentLink = (token: string) => verify(token, "resident_link");

export function residentSessionFromRequest(req: Request): Promise<number | null> {
  const cookies = parseCookieHeader(req.headers?.cookie ?? "");
  return verify(cookies[RESIDENT_COOKIE_NAME], "resident_session");
}

// Lien « Mon espace » des e-mails : connecte le résident en un clic.
export async function residentSpaceUrl(residentId: number): Promise<string> {
  return `${getPublicSiteUrl()}/resident/acces?t=${await signResidentLink(residentId)}`;
}
