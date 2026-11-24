import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Compte de la tablette de l'atelier : rôle « user » (seul usage de ce rôle). Il n'a
// accès qu'au pointage (kioskProcedure) et à « Mon espace » des résidents (routes
// residentAuth, ouvertes à tout compte connecté) ; toutes les autres routes sont admin.
export const TABLET_ROLE = "user" as const;

const requireAdminUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ce compte (tablette) n'a accès qu'au pointage." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Routes de gestion : réservées aux administrateurs.
export const protectedProcedure = t.procedure.use(requireAdminUser);

// Pointage de la tablette : administrateur ou compte tablette.
export const kioskProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
