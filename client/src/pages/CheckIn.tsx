import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useIsMobileLandscape } from "@/hooks/useMobile";

export default function CheckIn() {
  const [lastScan, setLastScan] = useState<{
    resident: any;
    action: "checkin" | "checkout";
    remainingHours?: number;
    remainingMinutes?: number;
    durationMinutes?: number;
  } | null>(null);
  
  const [selectedResident, setSelectedResident] = useState<any>(null);
  
  // États pour les animations clignotantes
  const [flashingRedResidentId, setFlashingRedResidentId] = useState<number | null>(null);
  const [flashingGreenResidentId, setFlashingGreenResidentId] = useState<number | null>(null);
  
  // Charger la liste des résidents actifs
  const { data: residents } = trpc.residents.list.useQuery();
  
  // Charger les pointages en cours
  const { data: openAttendances } = trpc.attendances.getOpenAttendances.useQuery();
  
  // Charger tous les forfaits
  const { data: allPackages } = trpc.packages.listAll.useQuery();
  
  // Créer un Set des IDs des résidents avec pointage en cours
  const residentsWithOpenAttendance = new Set(
    openAttendances?.map(a => a.residentId) || []
  );
  
  // Utiliser isActive de la base de données pour les codes couleur
  const residentsWithValidPackage = new Set(
    allPackages?.filter((pkg: any) => pkg.isActive).map((pkg: any) => pkg.residentId) || []
  );
  
  const residentsWithExpiredPackage = new Set(
    allPackages
      ?.filter((pkg: any) => !pkg.isActive)
      .filter((pkg: any) => !residentsWithValidPackage.has(pkg.residentId))
      .map((pkg: any) => pkg.residentId) || []
  );

  const utils = trpc.useUtils();

  const checkInMutation = trpc.attendances.checkIn.useMutation({
    onSuccess: (data) => {
      utils.attendances.getOpenAttendances.invalidate();
      utils.packages.invalidate();
      utils.residents.invalidate();
      setFlashingRedResidentId(null);
      setFlashingGreenResidentId(null);
      
      const residentId = selectedResident?.id;
      if (residentId) {
        setFlashingGreenResidentId(residentId);
        setTimeout(() => {
          setFlashingGreenResidentId(null);
        }, 1000);
      }
      if (data.action === 'checkout') {
        setLastScan({
          resident: data.resident,
          action: "checkout",
          durationMinutes: data.durationMinutes,
          remainingHours: data.remainingHours,
          remainingMinutes: data.remainingMinutes,
        });
        toast.success("Pointage de départ enregistré");
      } else {
        setLastScan({
          resident: data.resident,
          action: "checkin",
          remainingHours: data.remainingHours,
          remainingMinutes: data.remainingMinutes,
        });
        toast.success("Pointage d'arrivée enregistré");
      }
    },
    onError: (error) => {
      toast.error(error.message);
      
      if (error.message?.includes("Forfait épuisé")) {
        const residentId = selectedResident?.id;
        if (residentId) {
          setFlashingRedResidentId(residentId);
          setTimeout(() => {
            setFlashingRedResidentId(null);
          }, 1000);
        }
      }
    },
  });

  const handleResidentSelect = (resident: any) => {
    setSelectedResident(resident);
    checkInMutation.mutate({ residentId: resident.id });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, "0")}`;
  };

  const isLandscape = useIsMobileLandscape();

  // Composant bouton résident réutilisable
  const ResidentButton = ({ resident }: { resident: any }) => {
    const hasOpenAttendance = residentsWithOpenAttendance.has(resident.id);
    const hasValidPackage = residentsWithValidPackage.has(resident.id);
    const hasExpiredPackage = residentsWithExpiredPackage.has(resident.id);
    const isPresentWithExpiredPackage = hasOpenAttendance && hasExpiredPackage && !hasValidPackage;
    const openAttendance = openAttendances?.find((a: any) => a.residentId === resident.id);
    const checkInTime = openAttendance ? new Date(openAttendance.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
    let btnClass = 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-gray-300';
    if (flashingRedResidentId === resident.id) btnClass = 'animate-flash-red';
    else if (flashingGreenResidentId === resident.id) btnClass = 'animate-flash-green';
    else if (isPresentWithExpiredPackage) btnClass = 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100';
    else if (hasOpenAttendance) btnClass = 'bg-green-50 border-green-300 text-green-800 hover:bg-green-100';
    return (
      <div className="flex gap-2 w-full">
        <Button
          key={resident.id}
          variant="outline"
          size={isLandscape ? "sm" : "lg"}
          onClick={() => handleResidentSelect(resident)}
          disabled={checkInMutation.isPending}
          className={`h-auto ${isLandscape ? 'py-1.5 text-sm' : 'py-3 text-base'} font-medium flex-1 transition-all justify-between ${btnClass}`}
        >
          <span className="font-semibold">{resident.firstName} {resident.lastName}</span>
          <span className={`${isLandscape ? 'text-xs' : 'text-sm'} font-normal ml-2`}>
            {isPresentWithExpiredPackage ? (
              <span className="text-red-600">Expiré • {checkInTime}</span>
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
            window.location.href = "/resident/dashboard";
          }}
          className={`${isLandscape ? 'px-2 py-1.5 text-xs' : 'px-3 py-3 text-sm'} shrink-0 border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300`}
          title="Espace personnel"
        >
          {isLandscape ? '→' : 'Mon espace'}
        </Button>
      </div>
    );
  };

  const sortedResidents = residents?.filter((r: any) => r.isActive).sort((a: any, b: any) => a.firstName.localeCompare(b.firstName)) ?? [];

  // ── Mode paysage mobile : layout horizontal côte à côte ──
  if (isLandscape) {
    return (
      <div className="h-full flex gap-2 overflow-hidden">
        {/* Colonne gauche : liste résidents */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 shrink-0">Cliquez sur votre nom</p>
          <div className="flex flex-col gap-1 overflow-y-auto flex-1">
            <p className="text-xs text-red-600 font-medium mb-1">Oubli d'arrivée ? Clique sur "→" à côté de ton nom.</p>
            {sortedResidents.map((resident: any) => (
              <ResidentButton key={resident.id} resident={resident} />
            ))}
          </div>
        </div>

        {/* Colonne droite : confirmation */}
        <div className="w-52 shrink-0 flex flex-col justify-center">
          {lastScan ? (
            <div className={`rounded-lg border-2 p-3 ${
              lastScan.action === "checkin" ? "border-green-500 bg-green-50" : "border-blue-500 bg-blue-50"
            }`}>
              <div className="flex flex-col items-center gap-1 text-center">
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-white ${
                  lastScan.action === "checkin" ? "bg-green-600" : "bg-blue-600"
                }`}>
                  {lastScan.action === "checkin" ? "ENTRÉE" : "SORTIE"}
                </div>
                <CheckCircle className={`h-8 w-8 ${lastScan.action === "checkin" ? "text-green-600" : "text-blue-600"}`} />
                <p className={`text-sm font-bold ${lastScan.action === "checkin" ? "text-green-900" : "text-blue-900"}`}>
                  {lastScan.action === "checkin" ? `Bienvenue ${lastScan.resident?.firstName} !` : "À bientôt !"}
                </p>
                {lastScan.action === "checkout" && lastScan.durationMinutes !== undefined && (
                  <p className="text-xs text-blue-800 font-semibold">{formatDuration(lastScan.durationMinutes)}</p>
                )}
                {lastScan.remainingHours !== undefined && (
                  <p className={`text-xs font-semibold ${lastScan.action === "checkin" ? "text-green-800" : "text-blue-800"}`}>
                    Restant : {lastScan.remainingHours < 0 ? "-" : ""}{Math.abs(lastScan.remainingHours)}h
                    {Math.abs(lastScan.remainingMinutes!) > 0 ? Math.abs(lastScan.remainingMinutes!).toString().padStart(2, "0") : ""}
                  </p>
                )}
                {lastScan.resident && (
                  <button
                    onClick={() => { localStorage.setItem("residentId", lastScan.resident.id.toString()); window.location.href = "/resident/dashboard"; }}
                    className="mt-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Mon espace
                  </button>
                )}
              </div>
            </div>
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start sm:justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-1">Pointage Atelier</h1>
          <p className="text-sm text-gray-500">Cliquez sur votre nom pour pointer</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Sélectionner un Résident</CardTitle>
            <CardDescription className="text-center">Cliquez sur votre nom pour pointer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:gap-3 max-h-[60vh] sm:max-h-96 overflow-y-auto">
              {sortedResidents.map((resident: any) => (
                <ResidentButton key={resident.id} resident={resident} />
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-red-600 text-center font-medium">
          Tu as oublié de pointer ton heure d'arrivée ? Rends-toi dans ton espace personnel en cliquant sur le bouton <strong>"Mon espace"</strong> à côté de ton nom.
        </p>

      </div>
    </div>
  );
}
