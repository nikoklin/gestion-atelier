import { and, eq, gte } from "drizzle-orm";
import { getDb, recalculateAllResidents } from "./db";
import { attendances, emailLogs, packages, residents } from "../drizzle/schema";
import { OUT_OF_PACKAGE_LIMIT_MINUTES } from "./limits";
import { getParisDateString, formatParisDate } from "./_core/timezone";
import { getPublicSiteUrl } from "./_core/publicSiteUrl";
import { sendEmail, wrapEmailHtml, getAtelierNotificationEmail } from "./emailService";

// « error » = incohérence des données à corriger ; « todo » = situation à traiter
// (pas forcément anormale, mais qui demande une action de l'atelier).
export type Anomaly = {
  severity: "error" | "todo";
  rule: string;
  residentId?: number;
  residentName?: string;
  message: string;
};

const DAY_MS = 86400000;
const LONG_SESSION_MINUTES = 14 * 60;

type ResidentRow = typeof residents.$inferSelect;
const fullName = (r: Pick<ResidentRow, "firstName" | "lastName">) => `${r.firstName} ${r.lastName}`;

// Un forfait est « valable » s'il lui reste des heures et que sa date de fin n'est pas passée.
const isValid = (p: { totalHours: number; usedHours: number; endDate: Date | string }, now: Date) =>
  p.totalHours - p.usedHours > 0 && new Date(p.endDate) >= now;

const fmtMinutes = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

/**
 * Vérifie les règles de cohérence des données. `onlyResidentIds` limite le
 * contrôle à quelques résidents (tests, ou contrôle ciblé).
 */
export async function runIntegrityCheck(
  options: { now?: Date; onlyResidentIds?: number[] } = {}
): Promise<Anomaly[]> {
  const db = await getDb();
  if (!db) return [];
  const now = options.now ?? new Date();

  let residentRows = (await db.select().from(residents)).filter((r) => !r.isDeleted);
  if (options.onlyResidentIds) residentRows = residentRows.filter((r) => options.onlyResidentIds!.includes(r.id));
  const byId = new Map(residentRows.map((r) => [r.id, r]));
  const inScope = (residentId: number) => byId.has(residentId);
  const nameOf = (residentId: number) => (byId.get(residentId) ? fullName(byId.get(residentId)!) : undefined);

  const packageRows = (await db.select().from(packages)).filter((p) => inScope(p.residentId));
  const attendanceRows = (await db.select().from(attendances)).filter((a) => inScope(a.residentId));
  const anomalies: Anomaly[] = [];
  const add = (a: Omit<Anomaly, "residentName">) =>
    anomalies.push({ ...a, residentName: a.residentId ? nameOf(a.residentId) : undefined });

  // ── Pointages ───────────────────────────────────────────────────────────
  const today = getParisDateString(now);
  for (const a of attendanceRows) {
    if (a.attendanceType !== "normal") continue;
    const checkIn = new Date(a.checkInTime);

    if (!a.checkOutTime) {
      if (getParisDateString(checkIn) < today) {
        add({ severity: "error", rule: "open_attendance", residentId: a.residentId,
          message: `Pointage jamais clôturé : arrivée le ${formatParisDate(checkIn)} sans départ enregistré.` });
      }
    } else {
      const checkOut = new Date(a.checkOutTime);
      const computed = Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000);
      if (checkOut <= checkIn) {
        add({ severity: "error", rule: "bad_duration", residentId: a.residentId,
          message: `Pointage du ${formatParisDate(checkIn)} : le départ est avant (ou égal à) l'arrivée.` });
      } else if (Math.abs((a.durationMinutes ?? 0) - computed) > 1) {
        add({ severity: "error", rule: "bad_duration", residentId: a.residentId,
          message: `Pointage du ${formatParisDate(checkIn)} : durée enregistrée ${fmtMinutes(a.durationMinutes ?? 0)} au lieu de ${fmtMinutes(computed)}.` });
      } else if (computed > LONG_SESSION_MINUTES) {
        add({ severity: "todo", rule: "long_session", residentId: a.residentId,
          message: `Pointage du ${formatParisDate(checkIn)} très long (${fmtMinutes(computed)}) : à vérifier.` });
      }
    }
    if (checkIn.getTime() > now.getTime() + 5 * 60000) {
      add({ severity: "error", rule: "future_attendance", residentId: a.residentId,
        message: `Pointage dans le futur (arrivée le ${formatParisDate(checkIn)}).` });
    }
  }

  // ── Forfaits ────────────────────────────────────────────────────────────
  const packagesByResident = new Map<number, typeof packageRows>();
  for (const p of packageRows) {
    if (!packagesByResident.has(p.residentId)) packagesByResident.set(p.residentId, []);
    packagesByResident.get(p.residentId)!.push(p);
  }

  for (const [residentId, list] of Array.from(packagesByResident.entries())) {
    const real = list.filter((p) => p.status !== "pending");

    for (const p of list) {
      if (new Date(p.endDate) <= new Date(p.startDate)) {
        add({ severity: "error", rule: "package_dates", residentId,
          message: `Forfait #${p.id} : la date de fin (${formatParisDate(p.endDate)}) n'est pas après la date de début (${formatParisDate(p.startDate)}).` });
      }
    }

    for (const p of real) {
      if (p.usedHours > p.totalHours) {
        add({ severity: "error", rule: "used_over_total", residentId,
          message: `Forfait #${p.id} : ${fmtMinutes(p.usedHours)} utilisées pour un total de ${fmtMinutes(p.totalHours)}.` });
      }
      const valid = isValid(p, now);
      if (p.isActive !== valid) {
        add({ severity: "error", rule: "active_flag", residentId,
          message: `Forfait #${p.id} marqué ${p.isActive ? "actif" : "inactif"} alors qu'il est ${valid ? "encore valable" : "terminé"}.` });
      }
    }

    // Deux forfaits valables en même temps (chevauchement de plus d'un jour).
    const sorted = [...real].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const overlap = Math.min(new Date(sorted[i].endDate).getTime(), new Date(sorted[j].endDate).getTime())
          - Math.max(new Date(sorted[i].startDate).getTime(), new Date(sorted[j].startDate).getTime());
        if (overlap > DAY_MS) {
          add({ severity: "todo", rule: "package_overlap", residentId,
            message: `Les forfaits #${sorted[i].id} et #${sorted[j].id} se chevauchent de plus d'un jour.` });
        }
      }
    }

    // Forfait payé d'avance qui n'a pas démarré alors que plus aucun forfait n'est valable.
    const queued = list.filter((p) => p.status === "pending" && p.autoStart);
    if (queued.length > 0 && !real.some((p) => isValid(p, now))) {
      add({ severity: "error", rule: "queued_not_started", residentId,
        message: `Forfait payé d'avance #${queued[0].id} toujours en attente alors que le forfait précédent est terminé : il aurait dû démarrer.` });
    }
  }

  // ── Résidents ───────────────────────────────────────────────────────────
  const attendanceIds = new Set(attendanceRows.map((a) => a.id));
  for (const r of residentRows) {
    if (r.hasMissedCheckout && (!r.missedCheckoutAttendanceId || !attendanceIds.has(r.missedCheckoutAttendanceId))) {
      add({ severity: "error", rule: "missed_flag", residentId: r.id,
        message: "Alerte « pointage oublié » active, mais le pointage concerné n'existe plus." });
    }
    if ((r.outOfPackageMinutes ?? 0) >= OUT_OF_PACKAGE_LIMIT_MINUTES) {
      add({ severity: "todo", rule: "out_of_package_limit", residentId: r.id,
        message: `${fmtMinutes(r.outOfPackageMinutes ?? 0)} d'heures hors forfait : le pointage est bloqué tant que ce n'est pas régularisé.` });
    }
  }

  // Étagère attribuée à plusieurs résidents actifs.
  const byShelf = new Map<string, ResidentRow[]>();
  for (const r of residentRows) {
    const shelf = (r.shelfNumber ?? "").trim().toLowerCase();
    if (!r.isActive || !shelf) continue;
    if (!byShelf.has(shelf)) byShelf.set(shelf, []);
    byShelf.get(shelf)!.push(r);
  }
  for (const [shelf, owners] of Array.from(byShelf.entries())) {
    if (owners.length > 1) {
      add({ severity: "todo", rule: "duplicate_shelf", residentId: owners[0].id,
        message: `Étagère n°${shelf} attribuée à plusieurs résidents : ${owners.map(fullName).join(", ")}.` });
    }
  }

  // ── E-mails en échec sur les dernières 24 h ────────────────────────────
  const failed = await db
    .select()
    .from(emailLogs)
    .where(and(eq(emailLogs.success, false), gte(emailLogs.sentAt, new Date(now.getTime() - DAY_MS))));
  for (const log of failed) {
    if (!inScope(log.residentId)) continue;
    add({ severity: "todo", rule: "failed_email", residentId: log.residentId,
      message: `E-mail « ${log.emailType} » en échec vers ${log.recipientEmail}.` });
  }

  return anomalies;
}

// ─── Dérive du moteur de calcul pendant le recalcul de nuit ────────────────

export type StateSnapshot = {
  residents: Map<number, { name: string; outOfPackageMinutes: number }>;
  packages: Map<number, { residentId: number; totalHours: number; usedHours: number; isActive: boolean; status: string; endDate: Date }>;
};

export async function snapshotState(): Promise<StateSnapshot> {
  const db = await getDb();
  const snapshot: StateSnapshot = { residents: new Map(), packages: new Map() };
  if (!db) return snapshot;
  for (const r of await db.select().from(residents)) {
    snapshot.residents.set(r.id, { name: fullName(r), outOfPackageMinutes: r.outOfPackageMinutes ?? 0 });
  }
  for (const p of await db.select().from(packages)) {
    snapshot.packages.set(p.id, {
      residentId: p.residentId, totalHours: p.totalHours, usedHours: p.usedHours,
      isActive: p.isActive, status: p.status, endDate: new Date(p.endDate),
    });
  }
  return snapshot;
}

// Compare l'état avant/après le recalcul de nuit. Tout écart de heures utilisées ou de
// solde hors forfait signale une valeur qui n'était pas à jour ; les expirations par date
// et les démarrages de forfait payé d'avance sont normaux et ignorés.
export function detectDrift(before: StateSnapshot, after: StateSnapshot, now: Date): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const activatedResidents = new Set<number>();
  for (const [id, b] of Array.from(before.packages.entries())) {
    const a = after.packages.get(id);
    if (a && b.status === "pending" && a.status === "active") activatedResidents.add(b.residentId);
  }

  for (const [id, b] of Array.from(before.packages.entries())) {
    const a = after.packages.get(id);
    if (!a || activatedResidents.has(b.residentId)) continue;
    const name = after.residents.get(b.residentId)?.name;
    if (b.usedHours !== a.usedHours) {
      anomalies.push({ severity: "error", rule: "drift_used_hours", residentId: b.residentId, residentName: name,
        message: `Forfait #${id} : heures utilisées corrigées par le recalcul de nuit (${fmtMinutes(b.usedHours)} → ${fmtMinutes(a.usedHours)}).` });
    }
    if (b.isActive !== a.isActive) {
      const expectedExpiry = b.isActive && !a.isActive && (b.endDate < now || a.totalHours - a.usedHours <= 0);
      if (!expectedExpiry) {
        anomalies.push({ severity: "error", rule: "drift_active_flag", residentId: b.residentId, residentName: name,
          message: `Forfait #${id} : statut actif corrigé par le recalcul de nuit (${b.isActive ? "actif" : "inactif"} → ${a.isActive ? "actif" : "inactif"}).` });
      }
    }
  }
  for (const [id, b] of Array.from(before.residents.entries())) {
    const a = after.residents.get(id);
    if (!a || activatedResidents.has(id)) continue;
    if (b.outOfPackageMinutes !== a.outOfPackageMinutes) {
      anomalies.push({ severity: "error", rule: "drift_out_of_package", residentId: id, residentName: a.name,
        message: `Solde hors forfait corrigé par le recalcul de nuit (${fmtMinutes(b.outOfPackageMinutes)} → ${fmtMinutes(a.outOfPackageMinutes)}).` });
    }
  }
  return anomalies;
}

// ─── E-mail d'alerte ────────────────────────────────────────────────────────

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Renvoie null s'il n'y a rien à signaler (aucun e-mail n'est alors envoyé).
export function buildIntegrityEmail(anomalies: Anomaly[]): { subject: string; html: string } | null {
  if (anomalies.length === 0) return null;
  const site = getPublicSiteUrl();
  const list = (items: Anomaly[]) =>
    `<ul style="padding-left: 20px;">${items
      .map((a) => {
        const who = a.residentName ? `<strong>${escapeHtml(a.residentName)}</strong> — ` : "";
        const link = a.residentId ? ` <a href="${site}/residents/${a.residentId}" style="color: #c8860a;">Ouvrir la fiche</a>` : "";
        return `<li style="margin-bottom: 8px;">${who}${escapeHtml(a.message)}${link}</li>`;
      })
      .join("")}</ul>`;
  const errors = anomalies.filter((a) => a.severity === "error");
  const todos = anomalies.filter((a) => a.severity === "todo");
  const n = anomalies.length;
  return {
    subject: `Contrôle quotidien : ${n} point${n > 1 ? "s" : ""} à vérifier`,
    html: wrapEmailHtml(
      `
        <p style="margin-top: 0;">Le contrôle quotidien de l'application a repéré ${n} point${n > 1 ? "s" : ""} à vérifier.</p>
        ${errors.length ? `<p style="margin-bottom: 4px;"><strong>Incohérences à corriger (${errors.length})</strong></p>${list(errors)}` : ""}
        ${todos.length ? `<p style="margin-bottom: 4px;"><strong>À traiter (${todos.length})</strong></p>${list(todos)}` : ""}
      `,
      { closing: false, actionButton: { href: site, label: "Ouvrir l'application" } }
    ),
  };
}

// ─── Tâche de nuit ──────────────────────────────────────────────────────────

// Recalcule tous les résidents, puis contrôle les données. N'envoie un e-mail à
// l'atelier que s'il y a quelque chose à signaler.
export async function runNightlyMaintenance(): Promise<{ residents: number; anomalies: number; emailSent: boolean }> {
  // Le recalcul de nuit est prioritaire : une panne du contrôle ne doit jamais l'empêcher.
  let before: StateSnapshot | null = null;
  try {
    before = await snapshotState();
  } catch (error) {
    console.error("[Integrity] Impossible de photographier l'état avant recalcul:", error);
  }

  const { residents: count } = await recalculateAllResidents();

  let anomalies: Anomaly[] = [];
  try {
    const now = new Date();
    const drift = before ? detectDrift(before, await snapshotState(), now) : [];
    anomalies = [...drift, ...(await runIntegrityCheck({ now }))];
  } catch (error) {
    console.error("[Integrity] Le contrôle d'incohérences a échoué:", error);
  }

  const email = buildIntegrityEmail(anomalies);
  let emailSent = false;
  const to = getAtelierNotificationEmail();
  if (email && to) emailSent = await sendEmail(to, email.subject, email.html);

  console.log(`[Integrity] ${count} résidents recalculés, ${anomalies.length} point(s) à vérifier, e-mail ${emailSent ? "envoyé" : "non envoyé"}.`);
  return { residents: count, anomalies: anomalies.length, emailSent };
}
