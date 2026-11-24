import { describe, it, expect } from "vitest";
import { isAttendanceLocked, isPackageLocked, referencePackage } from "../shared/packageLock";
import { carriedOverPackageId } from "./db";

const now = new Date("2026-11-20T10:00:00Z");
const pkg = (id: number, start: string, used: number, extra: object = {}) => ({
  id, status: "active", totalHours: 60, usedHours: used,
  startDate: start, endDate: "2026-12-31T00:00:00Z", ...extra,
});

describe("Forfaits terminés figés", () => {
  it("sans forfait en cours (cas de Niko Klein) : seul le dernier forfait reste modifiable", () => {
    const old = pkg(1, "2026-10-23T00:00:00Z", 60);
    const last = pkg(2, "2026-11-16T09:44:00Z", 60);
    const queued = pkg(3, "2026-11-25T00:00:00Z", 0, { status: "pending" });
    const all = [last, old, queued];
    expect(referencePackage(all, now)?.id).toBe(2);
    expect(isPackageLocked(old, all, now)).toBe(true);
    expect(isPackageLocked(last, all, now)).toBe(false);
    expect(isPackageLocked(queued, all, now)).toBe(false);
    expect(isAttendanceLocked({ packageId: 1 }, all, now)).toBe(true);
    expect(isAttendanceLocked({ packageId: 2 }, all, now)).toBe(false);
    expect(isAttendanceLocked({ packageId: null }, all, now)).toBe(false); // hors forfait : corrigeable
  });

  it("avec un forfait en cours : lui seul et ses pointages sont modifiables", () => {
    const old = pkg(1, "2026-10-01T00:00:00Z", 60);
    const current = pkg(2, "2026-11-01T00:00:00Z", 10);
    const all = [old, current];
    expect(isPackageLocked(old, all, now)).toBe(true);
    expect(isPackageLocked(current, all, now)).toBe(false);
    expect(isAttendanceLocked({ packageId: 2 }, all, now)).toBe(false);
    expect(isAttendanceLocked({ packageId: 1 }, all, now)).toBe(true);
    expect(isAttendanceLocked({ packageId: null }, all, now)).toBe(true); // hors forfait repris par le forfait en cours
  });

  it("un seul forfait, même terminé : reste modifiable", () => {
    const only = pkg(1, "2026-10-01T00:00:00Z", 60);
    expect(isPackageLocked(only, [only], now)).toBe(false);
    expect(isAttendanceLocked({ packageId: 1 }, [only], now)).toBe(false);
  });
});

describe("Pointage hors forfait repris par un forfait suivant", () => {
  const pkgs = [
    { id: 1, status: "active", startDate: "2026-10-23T00:00:00Z", deductedMinutes: 0 },
    { id: 2, status: "active", startDate: "2026-11-18T17:25:00Z", deductedMinutes: 870 },
    { id: 3, status: "pending", startDate: "2026-12-01T00:00:00Z", deductedMinutes: 0 },
  ];
  it("prend la couleur du forfait qui l'a repris (cas de jean patrick, 17/11)", () => {
    expect(carriedOverPackageId({ packageId: null, checkInTime: "2026-11-17T06:40:00Z", attendanceType: "normal" }, pkgs)).toBe(2);
  });
  it("rien si le pointage a un forfait, si c'est un ajustement, ou si les heures n'ont pas été reportées", () => {
    expect(carriedOverPackageId({ packageId: 1, checkInTime: "2026-11-17T06:40:00Z" }, pkgs)).toBeNull();
    expect(carriedOverPackageId({ packageId: null, checkInTime: "2026-11-17T06:40:00Z", attendanceType: "adjustment_add" }, pkgs)).toBeNull();
    expect(carriedOverPackageId({ packageId: null, checkInTime: "2026-11-17T06:40:00Z" },
      [{ id: 2, status: "active", startDate: "2026-11-18T17:25:00Z", deductedMinutes: 0 }])).toBeNull();
    expect(carriedOverPackageId({ packageId: null, checkInTime: "2026-11-25T06:40:00Z" }, pkgs)).toBeNull(); // encore en attente de forfait
  });
});
