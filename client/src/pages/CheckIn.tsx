import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, CloudOff } from "lucide-react";
import { toast } from "sonner";
import { useIsMobileLandscape } from "@/hooks/useMobile";
import {
  enqueueKioskEvent,
  flushKioskQueue,
  newEventId,
  noteOutcome,
  onQueuedEventSent,
  refreshPending,
  sendKioskEvent,
  startKioskAutoFlush,
  subscribeKioskStatus,
  type KioskEvent,
  type KioskEventResult,
  type KioskStatus,
  FROM_KIOSK_KEY,
} from "@/lib/kioskQueue";

type KioskState = {
  residents: { id: number; firstName: string; lastName: string }[];
  openAttendances: { residentId: number; checkInTime: string }[];
  residentsWithValidPackage: number[];
  residentsWithExpiredPackage: number[];
  generatedAt: string;
};

// Dernières données reçues, gardées sur la tablette pour afficher la liste hors connexion.
const STATE_KEY = "kioskState";
function readCachedState(): KioskState | undefined {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as KioskState) : undefined;
  } catch {
    return undefined;
  }
}

const CONFIRMATION_MS = 3000;


type LastScan = {
  resident: { id: number; firstName: string; lastName?: string };
  action: "checkin" | "checkout";
  queued: boolean; // enregistré sur la tablette, envoi au retour du réseau
  remainingHours?: number;
  remainingMinutes?: number;
  durationMinutes?: number;
  isOutOfPackage?: boolean;
};

export default function CheckIn() {
  const [lastScan, setLastScan] = useState<LastScan | null>(null);
  // Le message de pointage s'efface après 3 s (un nouveau pointage relance le délai).
  useEffect(() => {
    if (!lastScan) return;
    const timer = setTimeout(() => setLastScan(null), CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [lastScan]);
  const [busy, setBusy] = useState(false);
  const [kiosk, setKiosk] = useState<KioskStatus | null>(null);

  // États pour les animations clignotantes
  const [flashingRedResidentId, setFlashingRedResidentId] = useState<number | null>(null);
  const [flashingGreenResidentId, setFlashingGreenResidentId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const [cachedState] = useState(readCachedState);
  const { data: liveState, error: stateError } = trpc.attendances.kioskState.useQuery(undefined, {
    refetchInterval: 60000,
    retry: 1,
  });
  // Session de la tablette expirée : signalé par l'indicateur (la page reste utilisable).
  useEffect(() => {
    if (stateError?.data?.code === "UNAUTHORIZED") noteOutcome({ kind: "retry", reason: "auth" });
  }, [stateError]);
  const state: KioskState | undefined = liveState ?? cachedState;

  useEffect(() => {
    if (!liveState) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(liveState));
    } catch { /* stockage plein ou indisponible : la liste ne sera simplement pas gardée */ }
  }, [liveState]);

  // Mise en cache de l'interface pour fonctionner sans réseau (service worker).
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("[Pointage] Service worker non installé :", err));
    }
  }, []);

  // Applique un pointage enregistré par le serveur aux données affichées, sans attendre le rechargement.
  const applyServerResult = (result: KioskEventResult) => {
    utils.attendances.kioskState.setData(undefined, (old) => {
      const base = old ?? readCachedState();
      if (!base) return old;
      const open = base.openAttendances.filter((a) => a.residentId !== result.resident.id);
      if (result.action === "checkin") open.push({ residentId: result.resident.id, checkInTime: result.occurredAt });
      return { ...base, openAttendances: open };
    });
    void utils.attendances.kioskState.invalidate();
  };

  useEffect(() => {
    const unsubscribeStatus = subscribeKioskStatus(setKiosk);
    const unsubscribeSent = onQueuedEventSent((result) => applyServerResult(result));
    const stop = startKioskAutoFlush();
    return () => {
      unsubscribeStatus();
      unsubscribeSent();
      stop();
    };
  }, []);

  const pending = kiosk?.pending ?? [];

  // Présents = pointages ouverts connus du serveur, plus les pointages encore dans la file.
  const openSince = useMemo(() => {
    const map = new Map<number, string>();
    state?.openAttendances.forEach((a) => map.set(a.residentId, a.checkInTime));
    for (const ev of pending) {
      if (ev.action === "checkin") map.set(ev.residentId, ev.occurredAt);
      else map.delete(ev.residentId);
    }
    return map;
  }, [state, pending]);

  const residentsWithValidPackage = new Set(state?.residentsWithValidPackage ?? []);
  const residentsWithExpiredPackage = new Set(state?.residentsWithExpiredPackage ?? []);

  const flash = (residentId: number, color: "green" | "red") => {
    const set = color === "green" ? setFlashingGreenResidentId : setFlashingRedResidentId;
    setFlashingRedResidentId(null);
    setFlashingGreenResidentId(null);
    set(residentId);
    setTimeout(() => set(null), 1000);
  };

  const handleResidentSelect = async (resident: KioskState["residents"][number]) => {
    if (busy) return;
    setBusy(true);
    const since = openSince.get(resident.id);
    const ev: KioskEvent = {
      eventId: newEventId(),
      residentId: resident.id,
      action: since ? "checkout" : "checkin",
      occurredAt: new Date().toISOString(),
      residentName: `${resident.firstName} ${resident.lastName}`,
      createdAt: Date.now(),
    };
    try {
      // File vide : envoi direct. Sinon on passe par la file pour garder l'ordre.
      const queueEmpty = (await refreshPending()).length === 0;
      if (queueEmpty) {
        const outcome = await sendKioskEvent(ev);
        noteOutcome(outcome);
        if (outcome.kind === "ok") {
          applyServerResult(outcome.result);
          flash(resident.id, "green");
          setLastScan({ ...outcome.result, resident: outcome.result.resident, queued: false });
          toast.success(outcome.result.action === "checkout" ? "Pointage de départ enregistré" : "Pointage d'arrivée enregistré", { duration: CONFIRMATION_MS });
          return;
        }
        if (outcome.kind === "rejected") {
          flash(resident.id, "red");
          toast.error(outcome.message);
          return;
        }
      }
      // Réseau indisponible : enregistré sur la tablette (confirmé seulement une fois écrit).
      await enqueueKioskEvent(ev);
      flash(resident.id, "green");
      setLastScan({
        resident,
        action: ev.action,
        queued: true,
        durationMinutes: since ? Math.max(0, Math.floor((Date.parse(ev.occurredAt) - Date.parse(since)) / 60000)) : undefined,
      });
      toast.success("Pointage enregistré sur la tablette : il sera envoyé dès le retour du réseau.", { duration: CONFIRMATION_MS });
      void flushKioskQueue();
    } catch (err) {
      console.error("[Pointage] Échec d'enregistrement :", err);
      flash(resident.id, "red");
      toast.error("Le pointage n'a pas pu être enregistré. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, "0")}`;
  };
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const isLandscape = useIsMobileLandscape();

  // Indicateur de connexion discret
  const ConnectionStatus = () => {
    if (!kiosk) return null;
    const count = kiosk.pending.length;
    const plural = count > 1 ? "s" : "";
    if (kiosk.authProblem) {
      return (
        <p className="text-xs text-red-600 font-medium">
          ● Session de la tablette expirée : reconnecter la tablette{count > 0 ? ` (${count} pointage${plural} en attente)` : ""}
        </p>
      );
    }
    if (!kiosk.online) {
      return (
        <p className="text-xs text-amber-700 font-medium inline-flex items-center gap-1">
          <CloudOff className="h-3 w-3" /> Hors ligne{count > 0 ? ` – ${count} pointage${plural} en attente` : ""}
        </p>
      );
    }
    if (count > 0) {
      return <p className="text-xs text-amber-700">● En ligne – envoi de {count} pointage{plural} en attente…</p>;
    }
    return <p className="text-xs text-green-700">● En ligne</p>;
  };

  // Composant bouton résident réutilisable
  const ResidentButton = ({ resident }: { resident: KioskState["residents"][number] }) => {
    const since = openSince.get(resident.id);
    const hasOpenAttendance = !!since;
    const hasValidPackage = residentsWithValidPackage.has(resident.id);
    const hasExpiredPackage = residentsWithExpiredPackage.has(resident.id);
    const isPresentWithExpiredPackage = hasOpenAttendance && hasExpiredPackage && !hasValidPackage;
    const checkInTime = since ? formatTime(since) : null;
    let btnClass = 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-gray-300';
    if (flashingRedResidentId === resident.id) btnClass = 'animate-flash-red';
    else if (flashingGreenResidentId === resident.id) btnClass = 'animate-flash-green';
    else if (hasOpenAttendance) btnClass = 'bg-green-50 border-green-300 text-green-800 hover:bg-green-100';
    return (
      <div className="flex gap-2 w-full">
        <Button
          key={resident.id}
          variant="outline"
          size={isLandscape ? "sm" : "lg"}
          onClick={() => handleResidentSelect(resident)}
          disabled={busy}
          className={`h-auto ${isLandscape ? 'py-1.5 text-sm' : 'py-3 text-base md:py-5 md:text-2xl'} font-medium flex-1 min-w-0 whitespace-normal text-left transition-all justify-between ${btnClass}`}
        >
          <span className="font-semibold">{resident.firstName} {resident.lastName}</span>
          <span className={`${isLandscape ? 'text-xs' : 'text-sm md:text-xl'} font-normal ml-2 shrink-0`}>
            {isPresentWithExpiredPackage ? (
              <span className="text-red-600 font-semibold">Hors forfait • {checkInTime} →</span>
            ) : hasOpenAttendance ? (
              <span className="text-green-700">{checkInTime} →</span>
            ) : null}
          </span>
        </Button>
        <Button
          variant="outline"
          size={isLandscape ? "sm" : "lg"}
          onClick={(e) => {
            e.stopPropagation();
            localStorage.setItem("residentId", resident.id.toString());
            sessionStorage.setItem(FROM_KIOSK_KEY, "1");
            window.location.href = "/resident/dashboard";
          }}
          className={`${isLandscape ? 'px-2 py-1.5 text-xs' : 'px-3 py-3 text-sm md:px-6 md:py-5 md:text-lg'} h-auto shrink-0 border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300`}
          title="Espace personnel"
        >
          {isLandscape ? '→' : 'Mon espace'}
        </Button>
      </div>
    );
  };

  const sortedResidents = state?.residents ?? [];

  // Confirmation affichée après un pointage (enregistré sur le serveur ou dans la file de la tablette)
  const Confirmation = ({ compact }: { compact: boolean }) => {
    if (!lastScan) return null;
    const isIn = lastScan.action === "checkin";
    return (
      <div className={`rounded-lg border-2 ${compact ? 'p-3' : 'p-4'} ${isIn ? "border-green-500 bg-green-50" : "border-blue-500 bg-blue-50"}`}>
        <div className="flex flex-col items-center gap-1 text-center">
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-white ${isIn ? "bg-green-600" : "bg-blue-600"}`}>
            {isIn ? "ENTRÉE" : "SORTIE"}
          </div>
          <CheckCircle className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} ${isIn ? "text-green-600" : "text-blue-600"}`} />
          <p className={`${compact ? 'text-sm' : 'text-base md:text-2xl'} font-bold ${isIn ? "text-green-900" : "text-blue-900"}`}>
            {isIn ? `Bienvenue ${lastScan.resident.firstName} !` : `À bientôt ${lastScan.resident.firstName} !`}
          </p>
          {lastScan.queued ? (
            <p className="text-xs text-amber-800">
              Pointage enregistré sur la tablette.<br />Il sera envoyé dès le retour du réseau.
            </p>
          ) : (
            <p className="text-xs text-gray-600">Pointage enregistré</p>
          )}
          {!isIn && lastScan.durationMinutes !== undefined && (
            <p className="text-xs text-blue-800 font-semibold">{formatDuration(lastScan.durationMinutes)}</p>
          )}
          {lastScan.remainingHours !== undefined && (
            lastScan.isOutOfPackage ? (
              <p className="text-xs font-semibold text-red-600">
                Hors forfait : {lastScan.remainingHours}h
                {lastScan.remainingMinutes! > 0 ? lastScan.remainingMinutes!.toString().padStart(2, "0") : "00"}
              </p>
            ) : (
              <p className={`text-xs font-semibold ${isIn ? "text-green-800" : "text-blue-800"}`}>
                Restant : {lastScan.remainingHours < 0 ? "-" : ""}{Math.abs(lastScan.remainingHours)}h
                {Math.abs(lastScan.remainingMinutes!) > 0 ? Math.abs(lastScan.remainingMinutes!).toString().padStart(2, "0") : ""}
              </p>
            )
          )}
          {compact && (
            <button
              onClick={() => { localStorage.setItem("residentId", lastScan.resident.id.toString()); sessionStorage.setItem(FROM_KIOSK_KEY, "1"); window.location.href = "/resident/dashboard"; }}
              className="mt-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Mon espace
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Mode paysage mobile : layout horizontal côte à côte ──
  if (isLandscape) {
    return (
      <div className="h-full flex gap-2 overflow-hidden">
        {/* Colonne gauche : liste résidents */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 mb-1 shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliquez sur votre nom</p>
            <ConnectionStatus />
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto flex-1">
            <p className="text-xs text-red-600 font-medium mb-1">Oubli d'arrivée ? Clique sur "→" à côté de ton nom.</p>
            {sortedResidents.map((resident) => (
              <ResidentButton key={resident.id} resident={resident} />
            ))}
          </div>
        </div>

        {/* Colonne droite : confirmation */}
        <div className="w-52 shrink-0 flex flex-col justify-center">
          {lastScan ? (
            <Confirmation compact />
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
              <p className="text-xs text-gray-400">Confirmation ici</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Mode portrait / desktop : layout original ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-2xl md:max-w-5xl">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-4xl font-semibold text-gray-800 mb-1">Pointage Atelier</h1>
          <p className="text-sm md:text-xl text-gray-500">Cliquez sur votre nom pour pointer</p>
          <div className="mt-1 flex justify-center"><ConnectionStatus /></div>
        </div>

        {lastScan && <div className="mb-4"><Confirmation compact={false} /></div>}

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-2 sm:gap-3 md:gap-4 max-h-[60vh] md:max-h-[72vh] overflow-y-auto">
              {sortedResidents.map((resident) => (
                <ResidentButton key={resident.id} resident={resident} />
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-sm md:text-lg text-red-600 text-center font-medium">
          Tu as oublié de pointer ton heure d'arrivée ? Rends-toi dans ton espace personnel en cliquant sur le bouton <strong>"Mon espace"</strong> à côté de ton nom.
        </p>

      </div>
    </div>
  );
}
