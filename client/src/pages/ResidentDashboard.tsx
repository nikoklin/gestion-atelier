import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Package, Calendar, PlusCircle } from "lucide-react";
import { APP_TITLE, APP_LOGO } from "@/const";
import { toast } from "sonner";

export default function ResidentDashboard() {
  const [, setLocation] = useLocation();
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionCheckInH, setSessionCheckInH] = useState("");
  const [sessionCheckInM, setSessionCheckInM] = useState("00");
  const [sessionCheckOutH, setSessionCheckOutH] = useState("");
  const [sessionCheckOutM, setSessionCheckOutM] = useState("00");
  const [sessionError, setSessionError] = useState("");

  // Récupérer l'ID de façon stable : URL en priorité, sinon localStorage
  const [residentId] = useState<number>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get("id");
    if (urlId) {
      const id = parseInt(urlId);
      localStorage.setItem("residentId", id.toString());
      return id;
    }
    return parseInt(localStorage.getItem("residentId") || "0");
  });

  // Nettoyer l'URL si un ID était présent
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("id")) {
      window.history.replaceState({}, '', '/resident/dashboard');
    }
  }, []);
  
  const utils = trpc.useUtils();

  const createSessionMutation = trpc.residentAuth.createManualSession.useMutation({
    onSuccess: (result) => {
      const h = Math.floor(result.durationMinutes / 60);
      const m = result.durationMinutes % 60;
      toast.success(`Session enregistrée : ${h > 0 ? h + 'h' : ''}${m > 0 ? m + 'min' : ''}`);
      setSessionDialogOpen(false);
      setSessionCheckInH("");
      setSessionCheckInM("00");
      setSessionCheckOutH("");
      setSessionCheckOutM("00");
      setSessionError("");
      utils.residentAuth.getInfo.invalidate();
    },
    onError: (err) => {
      setSessionError(err.message);
    },
  });

  const HOURS = Array.from({ length: 14 }, (_, i) => String(i + 8).padStart(2, '0')); // 08 à 21
  const MINUTES = ['00', '15', '30', '45'];

  const handleCreateSession = () => {
    setSessionError("");
    if (!sessionCheckInH || !sessionCheckOutH) {
      setSessionError("Veuillez sélectionner l'heure d'arrivée et l'heure de départ.");
      return;
    }
    const checkInVal = `${sessionCheckInH}:${sessionCheckInM}`;
    const checkOutVal = `${sessionCheckOutH}:${sessionCheckOutM}`;
    if (checkInVal >= checkOutVal) {
      setSessionError("L'heure de départ doit être après l'heure d'arrivée.");
      return;
    }
    // Utiliser la date locale (pas UTC) pour éviter le décalage de fuseau horaire
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // Construire des objets Date locaux et les envoyer en ISO avec offset
    const checkInDate = new Date(`${localDate}T${checkInVal}:00`);
    const checkOutDate = new Date(`${localDate}T${checkOutVal}:00`);
    createSessionMutation.mutate({
      residentId: residentId,
      checkInTime: checkInDate.toISOString(),
      checkOutTime: checkOutDate.toISOString(),
    });
  };

  const { data, isLoading } = trpc.residentAuth.getInfo.useQuery(
    { residentId: residentId },
    { enabled: residentId > 0 }
  );

  useEffect(() => {
    if (!residentId) {
      setLocation("/resident/login");
    }
  }, [residentId]);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, "0")}`;
  };

  const getPackageLabel = (type: string) => {
    switch (type) {
      case "15h_8w":
        return "15h / 8 semaines";
      case "30h_8w":
        return "30h / 8 semaines";
      case "30h_4w":
        return "30h / 4 semaines";
      default:
        return type;
    }
  };

  const getRemainingHours = (pkg: any) => {
    const remaining = pkg.totalHours - pkg.usedHours;
    // Plafonner à 0 : on n'affiche jamais de valeur négative
    const clamped = Math.max(0, remaining);
    return {
      text: clamped === 0 ? "0h00" : formatDuration(clamped),
      isNegative: remaining < 0
    };
  };

  const getTotalTime = () => {
    if (!data?.attendances) return "0h00";
    const total = data.attendances.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    return formatDuration(total);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Erreur de chargement</p>
      </div>
    );
  }

  const { resident, activePackage, attendances } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-10" />}
            <div>
              <h1 className="text-xl font-bold">
                {resident.firstName} {resident.lastName}
              </h1>
              <p className="text-sm text-muted-foreground">{resident.email}</p>
            </div>
          </div>
            <Dialog open={sessionDialogOpen} onOpenChange={(open) => { setSessionDialogOpen(open); if (!open) { setSessionError(""); setSessionCheckInH(""); setSessionCheckInM("00"); setSessionCheckOutH(""); setSessionCheckOutM("00"); } }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md">
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span>J'ai oublié d'enregistrer ma session&nbsp;!</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Enregistrer une session</DialogTitle>
                <DialogDescription>
                  Saisis tes heures d'arrivée et de départ pour aujourd'hui.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label>Heure d'arrivée</Label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
                      value={sessionCheckInH}
                      onChange={(e) => setSessionCheckInH(e.target.value)}
                    >
                      <option value="">Heure</option>
                      {HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
                    </select>
                    <select
                      className="w-24 border rounded-md px-3 py-2 text-sm bg-background"
                      value={sessionCheckInM}
                      onChange={(e) => setSessionCheckInM(e.target.value)}
                    >
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Heure de départ</Label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
                      value={sessionCheckOutH}
                      onChange={(e) => setSessionCheckOutH(e.target.value)}
                    >
                      <option value="">Heure</option>
                      {HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
                    </select>
                    <select
                      className="w-24 border rounded-md px-3 py-2 text-sm bg-background"
                      value={sessionCheckOutM}
                      onChange={(e) => setSessionCheckOutM(e.target.value)}
                    >
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                {sessionError && (
                  <p className="text-sm text-red-600">{sessionError}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSessionDialogOpen(false)}>Annuler</Button>
                <Button
                  onClick={handleCreateSession}
                  disabled={createSessionMutation.isPending}
                >
                  {createSessionMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Forfait actif */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Mon Forfait Actif
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activePackage ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Type de forfait</p>
                    <p className="text-lg font-semibold">{getPackageLabel(activePackage.packageType)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Heures restantes</p>
                    <p className={`text-lg font-semibold ${
                      getRemainingHours(activePackage).isNegative 
                        ? 'text-red-600' 
                        : 'text-green-600'
                    }`}>
                      {getRemainingHours(activePackage).text}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date d'expiration</p>
                    <p className="text-lg font-semibold">{activePackage.endDate ? formatDate(activePackage.endDate) : <span className="text-muted-foreground italic">En attente</span>}</p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {activePackage.startDate && activePackage.endDate ? (
                        `Forfait valable du ${formatDate(activePackage.startDate)} au ${formatDate(activePackage.endDate)}`
                      ) : (
                        <span className="italic">Forfait en attente d'activation</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun forfait actif</p>
                <p className="text-sm mt-2">Contactez l'atelier pour souscrire à un forfait</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historique des pointages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pointages du forfait en cours
            </CardTitle>
            <CardDescription>
              {attendances?.length || 0} pointage(s) • Temps total : {getTotalTime()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!attendances || attendances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun pointage enregistré</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Arrivée</TableHead>
                      <TableHead>Départ</TableHead>
                      <TableHead>Durée</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendances.map((attendance) => {
                      const checkInDate = new Date(attendance.checkInTime);
                      const isToday = checkInDate.toDateString() === new Date().toDateString();
                      
                      return (
                        <TableRow key={attendance.id} className={isToday ? "bg-blue-50/50" : ""}>
                          <TableCell className="font-medium">
                            {formatDate(attendance.checkInTime)}
                            {isToday && (
                              <span className="ml-2 text-xs text-blue-600 font-semibold">Aujourd'hui</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(attendance.checkInTime).toLocaleTimeString('fr-FR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </TableCell>
                          <TableCell>
                            {attendance.checkOutTime ? (
                              new Date(attendance.checkOutTime).toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                En cours
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {attendance.durationMinutes ? (
                              <span className="font-medium">{formatDuration(attendance.durationMinutes)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
