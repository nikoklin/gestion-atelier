import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

function getSessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export type SessionPayload = {
  openId: string;
  name: string;
};

/**
 * Signe un jeton de session (JWT HS256) avec le secret JWT_SECRET.
 * Remplace l'ancien mécanisme OAuth Manus — même cookie, même signature.
 */
export async function signSession(
  payload: SessionPayload,
  options: { expiresInMs?: number } = {}
): Promise<string> {
  const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);

  return new SignJWT({ openId: payload.openId, name: payload.name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSessionSecret());
}

export async function verifySession(
  cookieValue: string | undefined | null
): Promise<SessionPayload | null> {
  if (!cookieValue) return null;

  try {
    const { payload } = await jwtVerify(cookieValue, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    const { openId, name } = payload as Record<string, unknown>;

    if (!isNonEmptyString(openId) || !isNonEmptyString(name)) {
      return null;
    }

    return { openId, name };
  } catch (error) {
    console.warn("[Auth] Session verification failed", String(error));
    return null;
  }
}

/**
 * Authentifie une requête à partir du cookie de session.
 * Lève une erreur si la session est absente/invalide ou si l'utilisateur
 * n'existe pas en base. Ne synchronise plus depuis un serveur OAuth externe.
 */
export async function authenticateRequest(req: Request): Promise<User> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const session = await verifySession(cookies[COOKIE_NAME]);

  if (!session) {
    throw ForbiddenError("Invalid session cookie");
  }

  const user = await db.getUserByOpenId(session.openId);
  if (!user) {
    throw ForbiddenError("User not found");
  }

  // Met à jour la date de dernière connexion (sans toucher au rôle).
  await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

  // Ne jamais exposer le hash du mot de passe hors du serveur : l'utilisateur
  // en contexte (renvoyé notamment par auth.me) ne doit pas le contenir.
  return { ...user, passwordHash: null };
}
