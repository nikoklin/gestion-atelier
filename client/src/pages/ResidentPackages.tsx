import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { usePackageLabel } from "@/hooks/usePackageLabel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ArrowLeft, Clock, Trash2, RefreshCw, CalendarPlus, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function ResidentPackages() {
  const [, params] = useRoute("/residents/:id/packages");
  const [, setLocation] = useLocation();
  const residentId = params?.id ? parseInt(params.id) : 0;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [packageType, setPackageType] = useState<"15h_8w" | "30h_8w" | "30h_4w" | "180h_6m" | "">("15h_8w"); // "" = type dynamique sélectionné
  const [selectedPackageTypeId, setSelectedPackageTypeId] = useState<number | null>(null);

  // Types de forfaits dynamiques depuis la base de données
  const { data: dynamicPackageTypes } = trpc.packageTypes.getActive.useQuery();
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isAddHoursDialogOpen, setIsAddHoursDialogOpen] = useState(false);
  const [isExtendDateDialogOpen, setIsExtendDateDialogOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [hoursToAdd, setHoursToAdd] = useState(0);
  const [minutesToAdd, setMinutesToAdd] = useState(0);
  const [daysToExtend, setDaysToExtend] = useState(7);
  const [isSubtractHoursDialogOpen, setIsSubtractHoursDialogOpen] = useState(false);
  const [isSubtractDaysDialogOpen, setIsSubtractDaysDialogOpen] = useState(false);
  const [hoursToSubtract, setHoursToSubtract] = useState(0);
  const [minutesToSubtract, setMinutesToSubtract] = useState(0);
  const [daysToSubtract, setDaysToSubtract] = useState(1);
  const [isOutOfPackageWarningOpen, setIsOutOfPackageWarningOpen] = useState(false);
  const [deductOutOfPackageHours, setDeductOutOfPackageHours] = useState(true);
  const [outOfPackageMinutes, setOutOfPackageMinutes] = useState(0);

  // États pour la création de pointage
  const [isCreateAttendanceDialogOpen, setIsCreateAttendanceDialogOpen] = useState(false);
  const [createCheckInTime, setCreateCheckInTime] = useState("");
  const [createCheckOutTime, setCreateCheckOutTime] = useState("");

  // États pour la modification et suppression de pointage
  const [isEditAttendanceDialogOpen, setIsEditAttendanceDialogOpen] = useState(false);
  const [isDeleteAttendanceDialogOpen, setIsDeleteAttendanceDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [editCheckInTime, setEditCheckInTime] = useState("");
  const [editCheckOutTime, setEditCheckOutTime] = useState("");

  const utils = trpc.useUtils();
  const { data: resident } = trpc.residents.getById.useQuery({ id: residentId });
  const { data: pkgData, isLoading } = trpc.packages.getByResidentId.useQuery({ residentId });
  const packages = pkgData?.packages;
  const attendances = pkgData?.attendances;
  
  // Les heures hors forfait sont maintenant stockées directement dans resident.outOfPackageMinutes
  const totalOutOfPackageMinutesFromBackend = resident?.outOfPackageMinutes || 0;

  const clearOutOfPackageHoursMutation = trpc.packages.clearOutOfPackageHours.useMutation({
    onSuccess: () => {
      toast.success("Heures hors forfait effacées");
      utils.packages.getByResidentId.invalidate();
      utils.packages.getOutOfPackageHours.invalidate();
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const createMutation = trpc.packages.create.useMutation({
    onSuccess: () => {
      toast.success("Forfait créé avec succès");
      setIsCreateDialogOpen(false);
      utils.packages.getByResidentId.invalidate({ residentId });
      utils.packages.getOutOfPackageHours.invalidate();
      utils.residents.getWithActivePackage.invalidate();
      utils.residents.getById.invalidate({ id: residentId });
    },
    onError: (error) => {
      toast.error("Erreur lors de la création: " + error.message);
    },
  });

  const addHoursMutation = trpc.packages.addHours.useMutation({
    onSuccess: () => {
      toast.success("Heures ajoutées avec succès");
      setIsAddHoursDialogOpen(false);
      setHoursToAdd(0);
      setMinutesToAdd(0);
      utils.packages.getByResidentId.invalidate({ residentId });
      utils.packages.getOutOfPackageHours.invalidate();
      utils.residents.getWithActivePackage.invalidate();
      utils.residents.getById.invalidate({ id: residentId });
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const extendDateMutation = trpc.packages.extendDate.useMutation({
    onSuccess: () => {
      toast.success("Date prolongée avec succès");
      setIsExtendDateDialogOpen(false);
      setDaysToExtend(7);
      utils.packages.getByResidentId.invalidate({ residentId });
      utils.packages.getOutOfPackageHours.invalidate();
      utils.residents.getWithActivePackage.invalidate();
      utils.residents.getById.invalidate({ id: residentId });
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const subtractHoursMutation = trpc.packages.subtractHours.useMutation({
    onSuccess: () => {
      toast.success("Heures soustraites avec succès");
      setIsSubtractHoursDialogOpen(false);
      setHoursToSubtract(0);
      setMinutesToSubtract(0);
      utils.packages.getByResidentId.invalidate({ residentId });
      utils.packages.getOutOfPackageHours.invalidate();
      utils.residents.getWithActivePackage.invalidate();
      utils.residents.getById.invalidate({ id: residentId });
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const subtractDaysMutation = trpc.packages.subtractDays.useMutation({
    onSuccess: () => {
      toast.success("Jours soustraits avec succès");
      setIsSubtractDaysDialogOpen(false);
      setDaysToSubtract(1);
      utils.packages.getByResidentId.invalidate({ residentId });
      utils.packages.getOutOfPackageHours.invalidate();
      utils.residents.getWithActivePackage.invalidate();
      utils.residents.getById.invalidate({ id: residentId });
    },
    onError: (error) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const deleteMutation = trpc.packages.delete.useMutation({
    onSuccess: () => {
      toast.success("Forfait supprimé avec succès");
      utils.packages.getByResidentId.invalidate({ residentId });
      utils.packages.getOutOfPackageHours.invalidate();
      utils.residents.getWithActivePackage.invalidate();
      utils.residents.getById.invalidate({ id: residentId });
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression: " + error.message);
    },
  });

  const forceRecalculateMutation = trpc.packages.forceRecalculate.useMutation({
    onSuccess: (data) => {
      toast.success(`Recalcul effectué : ${data.packagesRecalculated} forfait(s) recalculé(s)`);
      utils.packages.getByResidentId.invalidate({ residentId });
      utils.packages.getOutOfPackageHours.invalidate();
      utils.residents.getWithActivePackage.invalidate();
      utils.residents.getById.invalidate({ id: residentId });
      utils.attendances.listAll.invalidate();
    },
    onError: (error) => {
      toast.error("Erreur lors du recalcul : " + error.message);
    },
  });

  const createAttendanceMutation = trpc.attendances.create.useMutation({
    onSuccess: () => {
      toast.success("Pointage créé avec succès");
      setIsCreateAttendanceDialogOpen(false);
      utils.packages.getByResidentId.invalidate({ residentId });
      utils.residents.getById.invalidate({ id: residentId });
      utils.residents.getWithActivePackage.invalidate();
    },
    onError: (error) => {
      toast.warning(error.message, { duration: 8000 });
      setIsCreateAttendanceDialogOpen(false);
      utils.packages.getByResidentId.invalidate({ residentId });
    },
  });

  const handleOpenCreateAttendanceDialog = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setCreateCheckInTime(dt);
    // Pré-remplir l'heure de sortie avec l'heure actuelle (format HH:mm)
    setCreateCheckOutTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setIsCreateAttendanceDialogOpen(true);
  };

  const handleConfirmCreateAttendance = () => {
    if (!createCheckInTime) {
      toast.error("L'heure d'arrivée est obligatoire");
      return;
    }
    // Reconstruire le datetime de sortie en combinant la date d'arrivée + l'heure de sortie
    let checkOutISO: string | null = null;
    if (createCheckOutTime) {
      const checkInDate = createCheckInTime.slice(0, 10); // YYYY-MM-DD
      // Comparer en minutes entières pour éviter les problèmes de fuseau horaire
      const [inH, inM] = createCheckInTime.slice(11).split(':').map(Number);
      const [outH, outM] = createCheckOutTime.split(':').map(Number);
      const inMinutes = inH * 60 + inM;
      const outMinutes = outH * 60 + outM;
      if (outMinutes <= inMinutes) {
        toast.error("L'heure de départ doit être postérieure à l'heure d'arrivée");
        return;
      }
      checkOutISO = new Date(`${checkInDate}T${createCheckOutTime}`).toISOString();
    }
    createAttendanceMutation.mutate({
      residentId,
      checkInTime: new Date(createCheckInTime).toISOString(),
      checkOutTime: checkOutISO,
    });
  };

  const updateAttendanceMutation = trpc.attendances.update.useMutation({
    onSuccess: () => {
      toast.success("Pointage modifié avec succès");
      setIsEditAttendanceDialogOpen(false);
      setSelectedAttendance(null);
      utils.packages.getByResidentId.invalidate({ residentId });
      utils.residents.getById.invalidate({ id: residentId });
      utils.residents.getWithActivePackage.invalidate();
    },
    onError: (error) => {
      utils.packages.getByResidentId.invalidate({ residentId });
      toast.warning(error.message, { duration: 8000 });
      setIsEditAttendanceDialogOpen(false);
      setSelectedAttendance(null);
    },
  });

  const deleteAttendanceMutation = trpc.attendances.delete.useMutation({
    onSuccess: () => {
      toast.success("Pointage supprimé avec succès");
      setIsDeleteAttendanceDialogOpen(false);
      setSelectedAttendance(null);
      utils.packages.getByResidentId.invalidate({ residentId });
      utils.residents.getById.invalidate({ id: residentId });
      utils.residents.getWithActivePackage.invalidate();
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  const toLocalDateTimeString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleEditAttendance = (attendance: any) => {
    setSelectedAttendance(attendance);
    const checkIn = new Date(attendance.checkInTime);
    const checkOut = attendance.checkOutTime ? new Date(attendance.checkOutTime) : null;
    setEditCheckInTime(toLocalDateTimeString(checkIn));
    // Stocker uniquement l'heure de sortie au format HH:mm
    if (checkOut) {
      const pad = (n: number) => String(n).padStart(2, '0');
      setEditCheckOutTime(`${pad(checkOut.getHours())}:${pad(checkOut.getMinutes())}`);
    } else {
      setEditCheckOutTime("");
    }
    setIsEditAttendanceDialogOpen(true);
  };

  const handleDeleteAttendance = (attendance: any) => {
    setSelectedAttendance(attendance);
    setIsDeleteAttendanceDialogOpen(true);
  };

  const confirmEditAttendance = () => {
    if (!selectedAttendance) return;
    if (!editCheckInTime) {
      toast.error("L'heure d'arrivée est obligatoire");
      return;
    }
    // Reconstruire le datetime de sortie en combinant la date d'arrivée + l'heure de sortie
    let checkOutISO: string | null = null;
    if (editCheckOutTime) {
      const checkInDate = editCheckInTime.slice(0, 10); // YYYY-MM-DD
      // Comparer en minutes entières pour éviter les problèmes de fuseau horaire
      const [inH, inM] = editCheckInTime.slice(11).split(':').map(Number);
      const [outH, outM] = editCheckOutTime.split(':').map(Number);
      const inMinutes = inH * 60 + inM;
      const outMinutes = outH * 60 + outM;
      if (outMinutes <= inMinutes) {
        toast.error("L'heure de départ doit être postérieure à l'heure d'arrivée");
        return;
      }
      checkOutISO = new Date(`${checkInDate}T${editCheckOutTime}`).toISOString();
    }
    updateAttendanceMutation.mutate({
      id: selectedAttendance.id,
      checkInTime: new Date(editCheckInTime).toISOString(),
      checkOutTime: checkOutISO,
    });
  };

  const confirmDeleteAttendance = () => {
    if (!selectedAttendance) return;
    deleteAttendanceMutation.mutate({ id: selectedAttendance.id });
  };

  const resetFlagsMutation = trpc.email.resetResidentEmailFlags.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error("Erreur lors de la réinitialisation: " + error.message);
    },
  });

  const activatePendingMutation = trpc.packages.activatePending.useMutation({
    onSuccess: () => {
      toast.success("Forfait activé avec succès");
      utils.packages.getByResidentId.invalidate({ residentId });
    },
    onError: (error) => {
      toast.error("Erreur lors de l'activation : " + error.message);
    },
  });

  const handleDeletePackage = (packageId: number) => {
    if (confirm("Voulez-vous vraiment supprimer ce forfait ? Cette action est irréversible.")) {
      deleteMutation.mutate({ id: packageId });
    }
  };

  // Construit l'objet de création selon le type sélectionné (statique ou dynamique)
  const buildCreateInput = (extra?: { deductOutOfPackageHours?: boolean; outOfPackageMinutes?: number }) => ({
    residentId,
    ...(selectedPackageTypeId
      ? { packageTypeId: selectedPackageTypeId }
      : { packageType: packageType as "15h_8w" | "30h_8w" | "30h_4w" | "180h_6m" }),
    startDate: new Date(startDate),
    ...extra,
  });

  const handleCreate = () => {
    if (!packageType && !selectedPackageTypeId) {
      toast.error('Veuillez sélectionner un type de forfait.');
      return;
    }

    // Vérifier si un forfait actif a déjà des heures déduites lors de sa création
    const hasActivePackageWithDeduction = packages && packages.length > 0
      ? packages.some(pkg => pkg.isActive && pkg.deductedMinutes && pkg.deductedMinutes > 0)
      : false;

    if (hasActivePackageWithDeduction) {
      createMutation.mutate(buildCreateInput());
      return;
    }
    
    const totalOutOfPackageMinutes = totalOutOfPackageMinutesFromBackend;
    if (totalOutOfPackageMinutes > 0) {
      setOutOfPackageMinutes(totalOutOfPackageMinutes);
      setIsOutOfPackageWarningOpen(true);
    } else {
      createMutation.mutate(buildCreateInput());
    }
  };
  
  const handleConfirmCreate = () => {
    createMutation.mutate(buildCreateInput({
      deductOutOfPackageHours,
      outOfPackageMinutes: deductOutOfPackageHours ? outOfPackageMinutes : 0,
    }));
    if (!deductOutOfPackageHours) {
      clearOutOfPackageHoursMutation.mutate({ residentId });
    }
    setIsOutOfPackageWarningOpen(false);
    setDeductOutOfPackageHours(true);
  };

  const { getPackageLabel } = usePackageLabel();

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("fr-FR");
  };

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString("fr-FR");
  };

  // Toutes les valeurs d'heures viennent du serveur (calculées dans packages.getByResidentId)
  // pkg.usedMinutes, pkg.remainingMinutes, pkg.outOfPackageMinutes sont injectés côté serveur

  // Comme dans l'espace personnel : utiliser directement usedHours et totalHours de la base
  // Ces valeurs sont maintenues à jour par fullRecalculateResident

  const getRealUsedMinutes = (pkg: any): number => {
    return pkg.usedHours || 0;
  };

  const getRemainingHours = (pkg: any) => {
    const remainingMinutes = Math.max(0, pkg.totalHours - getRealUsedMinutes(pkg));
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return `${hours}h${minutes > 0 ? minutes.toString().padStart(2, "0") : "00"}`;
  };

  const getOutOfPackageMinutes = (pkg: any): number => {
    return pkg.outOfPackageMinutes !== undefined ? pkg.outOfPackageMinutes : 0;
  };

  const getUsedHours = (pkg: any) => {
    // Afficher directement usedHours (inclut deductedMinutes + pointages réels)
    const used = getRealUsedMinutes(pkg);
    const hours = Math.floor(used / 60);
    const minutes = used % 60;
    return `${hours}h${minutes > 0 ? minutes.toString().padStart(2, "0") : "00"}`;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, "0")}`;
  };

  const isPackageExpired = (pkg: any) => {
    if (!pkg.endDate) return false;
    const now = new Date();
    const endDate = new Date(pkg.endDate);
    const realUsed = getRealUsedMinutes(pkg);
    return endDate < now || realUsed >= pkg.totalHours;
  };

  // Palette de couleurs pour les forfaits (fond + texte + bordure)
  const PACKAGE_COLORS = [
    { bg: 'bg-blue-50',   border: 'border-blue-300',   dot: 'bg-blue-400',   label: 'text-blue-700'   },
    { bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-400', label: 'text-emerald-700' },
    { bg: 'bg-violet-50', border: 'border-violet-300', dot: 'bg-violet-400', label: 'text-violet-700' },
    { bg: 'bg-amber-50',  border: 'border-amber-300',  dot: 'bg-amber-400',  label: 'text-amber-700'  },
    { bg: 'bg-rose-50',   border: 'border-rose-300',   dot: 'bg-rose-400',   label: 'text-rose-700'   },
    { bg: 'bg-cyan-50',   border: 'border-cyan-300',   dot: 'bg-cyan-400',   label: 'text-cyan-700'   },
    { bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-400', label: 'text-orange-700' },
    { bg: 'bg-teal-50',   border: 'border-teal-300',   dot: 'bg-teal-400',   label: 'text-teal-700'   },
  ];

  // Associer chaque forfait (trié par id croissant) à une couleur
  const packageColorMap = useMemo(() => {
    if (!packages) return new Map<number, typeof PACKAGE_COLORS[0]>();
    const sorted = [...packages].sort((a, b) => a.id - b.id);
    const map = new Map<number, typeof PACKAGE_COLORS[0]>();
    sorted.forEach((pkg, i) => {
      map.set(pkg.id, PACKAGE_COLORS[i % PACKAGE_COLORS.length]);
    });
    return map;
  }, [packages]);

  const getExpirationDate = (pkg: any) => {
    if (!pkg.endDate) return "-"; // Les forfaits en attente n'ont pas de date d'expiration
    // Si le forfait est épuisé (heures réelles >= totalHours), trouver la date du dernier pointage
    const realUsed = getRealUsedMinutes(pkg);
    if (realUsed >= pkg.totalHours && attendances) {
      const pkgAttendances = attendances.filter(a => a.packageId === pkg.id && a.checkOutTime);
      if (pkgAttendances.length > 0) {
        // Trouver le dernier pointage de départ
        const lastAttendance = pkgAttendances.reduce((latest, current) => {
          const currentDate = new Date(current.checkOutTime!);
          const latestDate = new Date(latest.checkOutTime!);
          return currentDate > latestDate ? current : latest;
        });
        return formatDate(lastAttendance.checkOutTime!);
      }
    }
    // Sinon, retourner la date de fin de validité
    return formatDate(pkg.endDate);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container py-4 md:py-8">
      <div className="mb-4">
        <Button variant="outline" size="sm" onClick={() => setLocation(`/residents/${residentId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au profil
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            {resident?.firstName} {resident?.lastName}
          </CardTitle>
          <CardDescription>{resident?.email}</CardDescription>
        </CardHeader>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Forfaits</CardTitle>
              <CardDescription>Historique des forfaits du résident</CardDescription>
            </div>
              <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  disabled={packages && packages.some(pkg => pkg.isActive && (pkg.totalHours - pkg.usedHours) > 0)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau Forfait
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => resetFlagsMutation.mutate({ residentId })}
                  disabled={resetFlagsMutation.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Réinitialisation Rappel
                </Button>
              </div>
              {packages && packages.some(pkg => pkg.isActive && (pkg.totalHours - pkg.usedHours) > 0) && (
                <p className="text-sm text-muted-foreground">
                  Un forfait est déjà actif pour ce résident. Attendez son expiration ou désactivez-le pour en créer un nouveau.
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date de début</TableHead>
                <TableHead>Date de fin</TableHead>
                <TableHead>Date d'expiration</TableHead>
                <TableHead>Heures utilisées</TableHead>
                <TableHead>Heures restantes</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages?.map((pkg) => {
                const color = packageColorMap.get(pkg.id);
                return (
                <TableRow key={pkg.id} className={color?.bg}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${color?.dot}`} />
                      {getPackageLabel(pkg.packageType)}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(pkg.startDate)}</TableCell>
                  <TableCell>{formatDate(pkg.endDate)}</TableCell>
                  <TableCell>{getExpirationDate(pkg)}</TableCell>
                  <TableCell>
                    <span>{getUsedHours(pkg)}</span>
                    {getOutOfPackageMinutes(pkg) > 0 && (
                      <span className="text-red-600 ml-1">
                        (dont {formatDuration(getOutOfPackageMinutes(pkg))} hors forfait)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{getRemainingHours(pkg)}</TableCell>
                  <TableCell>
                    {(pkg as any).status === 'pending' ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        En attente
                      </span>
                    ) : pkg.isActive ? (
                      isPackageExpired(pkg) ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                          Actif (Expiré)
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          Actif
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                        Expiré
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {(pkg as any).status === 'pending' && (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => activatePendingMutation.mutate({ packageId: pkg.id })}
                          disabled={activatePendingMutation.isPending}
                        >
                          Activer
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPackageId(pkg.id);
                          setIsAddHoursDialogOpen(true);
                        }}
                      >
                        + Heures
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPackageId(pkg.id);
                          setIsSubtractHoursDialogOpen(true);
                        }}
                      >
                        - Heures
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPackageId(pkg.id);
                          setIsExtendDateDialogOpen(true);
                        }}
                      >
                        + Jours
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPackageId(pkg.id);
                          setIsSubtractDaysDialogOpen(true);
                        }}
                      >
                        - Jours
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePackage(pkg.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pointages associéseurs */}
      {packages && packages.length > 0 && (
        <div className="flex flex-wrap gap-3 px-1 mb-2">
          {[...packages].sort((a, b) => a.id - b.id).map((pkg) => {
            const color = packageColorMap.get(pkg.id);
            return (
              <div key={pkg.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${color?.bg} ${color?.border} ${color?.label}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${color?.dot}`} />
                {getPackageLabel(pkg.packageType)} — {formatDate(pkg.startDate)}
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 flex-shrink-0" />
                Historique des Pointages
              </CardTitle>
              <CardDescription className="mt-1">
                {attendances?.filter(a => a.attendanceType !== 'adjustment_add' && a.attendanceType !== 'adjustment_subtract').length || 0} pointage(s) au total
                {attendances && attendances.length > 0 && (
                  <span className="ml-2">
                    • Temps total : {formatDuration(
                      attendances
                        .filter(a => a.attendanceType !== 'adjustment_add' && a.attendanceType !== 'adjustment_subtract')
                        .reduce((sum, a) => sum + (a.durationMinutes || 0), 0)
                    )}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => forceRecalculateMutation.mutate({ residentId })}
                disabled={forceRecalculateMutation.isPending}
                title="Recalculer les heures de tous les forfaits depuis le premier pointage"
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">{forceRecalculateMutation.isPending ? "Recalcul..." : "Recalculer"}</span>
              </Button>
              <Button size="sm" onClick={handleOpenCreateAttendanceDialog}>
                <CalendarPlus className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Nouveau </span>Pointage
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!attendances || attendances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun pointage enregistré</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Départ</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((attendance: any) => {
                    const checkInDate = new Date(attendance.checkInTime);
                    const isToday = checkInDate.toDateString() === new Date().toDateString();
                    const isAdjustAdd = attendance.attendanceType === 'adjustment_add';
                    const isAdjustSubtract = attendance.attendanceType === 'adjustment_subtract';
                    const isAdjustment = isAdjustAdd || isAdjustSubtract;
                    
                    // Utiliser isOutOfPackage calculé côté serveur (recalcul chronologique)
                    const isOutOfPackage = !isAdjustment && (attendance.isOutOfPackage === true);

                    // Couleur du forfait associé — TOUJOURS garder la couleur du forfait, même hors forfait
                    const attColor = attendance.packageId ? packageColorMap.get(attendance.packageId) : undefined;
                    const rowBg = isAdjustment ? 'bg-purple-50' : (attColor ? attColor.bg : '');
                    
                    return (
                      <TableRow key={attendance.id} className={rowBg}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isAdjustAdd && <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 bg-purple-400" />}
                            {isAdjustSubtract && <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 bg-orange-400" />}
                            {!isAdjustment && <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${attColor?.dot ?? 'bg-gray-300'}`} />}
                            <span>
                              {isAdjustment ? (
                                <span className="italic text-purple-700">
                                  {formatDate(attendance.checkInTime)}
                                  {isToday && <span className="ml-2 text-xs font-semibold text-gray-600">Aujourd'hui</span>}
                                </span>
                              ) : (
                                <span>
                                  {formatDate(attendance.checkInTime)}
                                  {isToday && <span className="ml-2 text-xs font-semibold text-gray-600">Aujourd'hui</span>}
                                </span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isAdjustment ? (
                            <span className="text-muted-foreground text-xs italic">—</span>
                          ) : (
                            new Date(attendance.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdjustment ? (
                            <span className="text-muted-foreground text-xs italic">—</span>
                          ) : attendance.checkOutTime ? (
                            new Date(attendance.checkOutTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {attendance.durationMinutes ? (
                            <span className={`font-medium ${
                              isAdjustAdd ? 'text-purple-700' : 
                              isAdjustSubtract ? 'text-orange-700' : 
                              isOutOfPackage ? 'text-red-600' : ''
                            }`}>
                              {isAdjustAdd && '+'}{isAdjustSubtract && '-'}{formatDuration(attendance.durationMinutes)}
                              {isOutOfPackage && !isAdjustment && <span className="ml-1 text-xs">(Hors forfait)</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdjustment ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                              isAdjustAdd 
                                ? 'bg-purple-50 text-purple-700 ring-purple-600/20' 
                                : 'bg-orange-50 text-orange-700 ring-orange-600/20'
                            }`}>
                              {isAdjustAdd ? '+ Ajout atelier' : '- Retrait atelier'}
                            </span>
                          ) : attendance.checkOutTime ? (
                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                              Terminé
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                              En cours
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!isAdjustment && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditAttendance(attendance)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteAttendance(attendance)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Dialog d'ajout d'heures */}
      <Dialog open={isAddHoursDialogOpen} onOpenChange={setIsAddHoursDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter des Heures</DialogTitle>
            <DialogDescription>
              Ajouter des heures au forfait sélectionné
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="hours">Heures</Label>
              <input
                id="hours"
                type="number"
                min="0"
                value={hoursToAdd}
                onChange={(e) => setHoursToAdd(parseInt(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minutes">Minutes</Label>
              <input
                id="minutes"
                type="number"
                min="0"
                max="59"
                value={minutesToAdd || ''}
                onChange={(e) => setMinutesToAdd(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddHoursDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => {
                if (selectedPackageId) {
                  addHoursMutation.mutate({
                    packageId: selectedPackageId,
                    hours: hoursToAdd,
                    minutes: minutesToAdd,
                  });
                }
              }}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de soustraction d'heures */}
      <Dialog open={isSubtractHoursDialogOpen} onOpenChange={setIsSubtractHoursDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soustraire des Heures</DialogTitle>
            <DialogDescription>
              Retirer des heures du forfait sélectionné
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="subtract-hours">Heures</Label>
              <input
                id="subtract-hours"
                type="number"
                min="0"
                value={hoursToSubtract}
                onChange={(e) => setHoursToSubtract(parseInt(e.target.value) || 0)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subtract-minutes">Minutes</Label>
              <input
                id="subtract-minutes"
                type="number"
                min="0"
                max="59"
                value={minutesToSubtract || ''}
                onChange={(e) => setMinutesToSubtract(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubtractHoursDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (selectedPackageId) {
                  subtractHoursMutation.mutate({
                    packageId: selectedPackageId,
                    hours: hoursToSubtract,
                    minutes: minutesToSubtract,
                  });
                }
              }}
            >
              Soustraire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de soustraction de jours */}
      <Dialog open={isSubtractDaysDialogOpen} onOpenChange={setIsSubtractDaysDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soustraire des Jours</DialogTitle>
            <DialogDescription>
              Réduire la date d'expiration du forfait
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="subtract-days">Nombre de jours</Label>
              <input
                id="subtract-days"
                type="number"
                min="1"
                value={daysToSubtract}
                onChange={(e) => setDaysToSubtract(parseInt(e.target.value) || 1)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubtractDaysDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (selectedPackageId) {
                  subtractDaysMutation.mutate({
                    packageId: selectedPackageId,
                    days: daysToSubtract,
                  });
                }
              }}
            >
              Soustraire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de prolongation de date */}
      <Dialog open={isExtendDateDialogOpen} onOpenChange={setIsExtendDateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prolonger la Date</DialogTitle>
            <DialogDescription>
              Prolonger la date d'expiration du forfait
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="days">Nombre de jours</Label>
              <input
                id="days"
                type="number"
                min="1"
                value={daysToExtend}
                onChange={(e) => setDaysToExtend(parseInt(e.target.value) || 1)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtendDateDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => {
                if (selectedPackageId) {
                  extendDateMutation.mutate({
                    packageId: selectedPackageId,
                    days: daysToExtend,
                  });
                }
              }}
            >
              Prolonger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de création de forfait */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau Forfait</DialogTitle>
            <DialogDescription>
              Créer un nouveau forfait pour {resident?.firstName} {resident?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="packageType">Type de forfait</Label>
              <Select
                value={selectedPackageTypeId ? `dyn_${selectedPackageTypeId}` : packageType}
                onValueChange={(value) => {
                  if (value.startsWith('dyn_')) {
                    setSelectedPackageTypeId(parseInt(value.replace('dyn_', ''), 10));
                    setPackageType('');
                  } else {
                    setSelectedPackageTypeId(null);
                    setPackageType(value as any);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un forfait" />
                </SelectTrigger>
                <SelectContent>
                  {/* Types dynamiques depuis la base de données */}
                  {dynamicPackageTypes && dynamicPackageTypes.length > 0 && (
                    <>
                      {dynamicPackageTypes.map((pt: any) => (
                        <SelectItem key={`dyn_${pt.id}`} value={`dyn_${pt.id}`}>
                          {pt.label} — {pt.price} €
                        </SelectItem>
                      ))}
                      <div className="border-t my-1" />
                    </>
                  )}
                  {/* Types statiques (rétro-compatibilité) — masqués si des types dynamiques existent */}
                  {(!dynamicPackageTypes || dynamicPackageTypes.length === 0) && (
                    <>
                      <SelectItem value="15h_8w">15h / 8 semaines</SelectItem>
                      <SelectItem value="30h_8w">30h / 8 semaines</SelectItem>
                      <SelectItem value="30h_4w">30h / 4 semaines</SelectItem>
                      <SelectItem value="180h_6m">180h / 6 mois</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="startDate">Date de début</Label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de modification de pointage */}
      <Dialog open={isEditAttendanceDialogOpen} onOpenChange={setIsEditAttendanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le pointage</DialogTitle>
            <DialogDescription>
              Modifiez les heures d'arrivée et de départ du pointage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-checkin">Heure d'arrivée</Label>
              <input
                id="edit-checkin"
                type="datetime-local"
                value={editCheckInTime}
                onChange={(e) => {
                  const newCheckIn = e.target.value;
                  setEditCheckInTime(newCheckIn);
                  // Si la sortie n'est pas le même jour, la réinitialiser
                  if (editCheckOutTime && newCheckIn) {
                    const inDay = newCheckIn.slice(0, 10);
                    const outDay = editCheckOutTime.slice(0, 10);
                    if (outDay !== inDay) setEditCheckOutTime("");
                  }
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-checkout">Heure de départ</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  id="edit-checkout"
                  type="time"
                  value={editCheckOutTime}
                  onChange={(e) => setEditCheckOutTime(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {editCheckInTime && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    le {new Date(editCheckInTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditAttendanceDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={confirmEditAttendance} disabled={updateAttendanceMutation.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de suppression de pointage */}
      <Dialog open={isDeleteAttendanceDialogOpen} onOpenChange={setIsDeleteAttendanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce pointage ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteAttendanceDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDeleteAttendance} disabled={deleteAttendanceMutation.isPending}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de création de pointage */}
      <Dialog open={isCreateAttendanceDialogOpen} onOpenChange={setIsCreateAttendanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un pointage</DialogTitle>
            <DialogDescription>
              Créez un nouveau pointage pour {resident?.firstName} {resident?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-checkin">Heure d'arrivée *</Label>
              <input
                id="create-checkin"
                type="datetime-local"
                value={createCheckInTime}
                onChange={(e) => {
                  const newCheckIn = e.target.value;
                  setCreateCheckInTime(newCheckIn);
                  // Si la sortie n'est pas le même jour, la réinitialiser
                  if (createCheckOutTime && newCheckIn) {
                    const inDay = newCheckIn.slice(0, 10);
                    const outDay = createCheckOutTime.slice(0, 10);
                    if (outDay !== inDay) setCreateCheckOutTime("");
                  }
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="create-checkout">Heure de départ</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  id="create-checkout"
                  type="time"
                  value={createCheckOutTime}
                  onChange={(e) => setCreateCheckOutTime(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {createCheckInTime && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    le {new Date(createCheckInTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Effacez le champ pour créer un pointage en cours
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateAttendanceDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirmCreateAttendance} disabled={createAttendanceMutation.isPending}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue d'avertissement pour heures hors forfait */}
      <Dialog open={isOutOfPackageWarningOpen} onOpenChange={(open) => {
        setIsOutOfPackageWarningOpen(open);
        if (!open) setDeductOutOfPackageHours(true); // Réinitialiser pour la prochaine fois
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-orange-600">Heures Hors Forfait Détectées</DialogTitle>
            <DialogDescription>
              Ce résident a accumulé <strong className="text-red-600">
                {Math.floor(outOfPackageMinutes / 60)}h{String(outOfPackageMinutes % 60).padStart(2, '0')}
              </strong> d'heures hors forfait.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="deductHours"
                checked={deductOutOfPackageHours}
                onChange={(e) => setDeductOutOfPackageHours(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="deductHours" className="text-sm">
                Déduire ces heures du nouveau forfait
                {deductOutOfPackageHours && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    Le nouveau forfait commencera avec {Math.floor(outOfPackageMinutes / 60)}h{String(outOfPackageMinutes % 60).padStart(2, '0')} déjà utilisées
                  </span>
                )}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsOutOfPackageWarningOpen(false);
              setDeductOutOfPackageHours(true);
            }}>
              Annuler
            </Button>
            <Button onClick={handleConfirmCreate}>Confirmer et Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
