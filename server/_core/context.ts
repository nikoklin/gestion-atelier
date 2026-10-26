import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateRequest } from "./session";
import { residentSessionFromRequest } from "./residentSession";
import { getResidentById } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  // Résident connecté à son espace (cookie de session résident), sinon null.
  residentId?: number | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Un résident archivé ou inactif perd l'accès à son espace.
  let residentId = await residentSessionFromRequest(opts.req);
  if (residentId) {
    const resident = await getResidentById(residentId).catch(() => null);
    if (!resident || !resident.isActive || resident.isDeleted) residentId = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    residentId,
  };
}
