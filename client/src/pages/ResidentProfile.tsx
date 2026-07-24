import { useParams, useLocation, useSearch } from "wouter";
import SignaturePad from "@/components/SignaturePad";
import { trpc } from "@/lib/trpc";
import { usePackageLabel } from "@/hooks/usePackageLabel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Trash2, Package, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ResidentProfile() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getPackageLabel } = usePackageLabel();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEditAttendanceDialog, setShowEditAttendanceDialog] = useState(false);
  const [showDeleteAttendanceDialog, setShowDeleteAttendanceDialog] = useState(false);
  const [showCreateAttendanceDialog, setShowCreateAttendanceDialog] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [editCheckInTime, setEditCheckInTime] = useState("");
  const [editCheckOutTime, setEditCheckOutTime] = useState("");
  
  // États pour le formulaire de création de pointage
  const [createCheckInTime, setCreateCheckInTime] = useState("");
  const [createCheckOutTime, setCreateCheckOutTime] = useState("");
  
  // États pour le formulaire de modification
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editShelfNumber, setEditShelfNumber] = useState("");
  const [editArtistSignature, setEditArtistSignature] = useState<string | null>(null);
  
  // États pour les erreurs de validation
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // États pour les notes
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showDeleteNoteDialog, setShowDeleteNoteDialog] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);

  const residentId = parseInt(id || "0");
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const openAttendanceId = searchParams.get("openAttendance") ? parseInt(searchParams.get("openAttendance")!) : null;
  const initialTab = searchParams.get("tab") || "informations";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Récupérer les informations du résident
  const { data: resident, isLoading } = trpc.residents.getById.useQuery(
    { id: residentId },
    { enabled: residentId > 0 }
  );

  // Récupérer l'historique des forfaits et des pointages enrichis
  const { data: pkgData, isLoading: isLoadingPackages } = trpc.packages.getByResidentId.useQuery(
    { residentId },
    { enabled: residentId > 0 }
  );
  const packages = pkgData?.packages;
  const attendances = pkgData?.attendances;
  const isLoadingAttendances = isLoadingPackages;
  // Utiliser le dernier forfait (actif ou expiré) pour l'affichage
  const latestPackage = packages && packages.length > 0 
    ? packages.reduce((latest: any, pkg: any) => pkg.id > latest.id ? pkg : latest, packages[0])
    : null;
  const activePackage = packages?.find((p: any) => p.isActive);

  // Récupérer l'historique des e-mails
  const { data: emailLogs, isLoading: emailLogsLoading } = trpc.emailLogs.getByResidentId.useQuery(
    { residentId },
    { enabled: residentId > 0 }
  );

  // Récupérer les notes
  const { data: notes, isLoading: notesLoading } = trpc.notes.getByResidentId.useQuery(
    { residentId },
    { enabled: residentId > 0 }
  );

  // Le cumul des heures hors forfait est maintenant stocké directement dans resident.outOfPackageMinutes
  const totalOutOfPackageMinutes = resident?.outOfPackageMinutes || 0;
const utils = trpc.useUtils();

  // Ouvrir automatiquement le dialog de modification si openAttendanceId est dans l'URL
  useEffect(() => {
    if (openAttendanceId && attendances && attendances.length > 0 && !showEditAttendanceDialog) {
      const attendance = attendances.find((a: any) => a.id === openAttendanceId);
      if (attendance) {
        setActiveTab("pointages");
        handleEditAttendance(attendance);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAttendanceId, attendances]);

  // Mutations pour les notes
  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.getByResidentId.invalidate({ residentId });
      setShowAddNoteDialog(false);
      setNewNoteContent("");
      toast.success("Note ajoutée avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout de la note");
    },
  });

  const updateNoteMutation = trpc.notes.update.useMutation({
    onSuccess: () => {
      utils.notes.getByResidentId.invalidate({ residentId });
      setEditingNoteId(null);
      setEditNoteContent("");
      toast.success("Note modifiée avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de la modification de la note");
    },
  });

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.getByResidentId.invalidate({ residentId });
      setShowDeleteNoteDialog(false);
      setSelectedNoteId(null);
      toast.success("Note supprimée avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression de la note");
    },
  });

  // Mutation pour modifier le résident
  
  const updateMutation = trpc.residents.update.useMutation({
    onSuccess: () => {
      toast.success("Informations modifiées avec succès");
      utils.residents.getWithActivePackage.invalidate();
      utils.residents.getById.invalidate({ id: residentId });
      setShowEditDialog(false);
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  // Mutation pour supprimer le résident
  const deleteMutation = trpc.residents.delete.useMutation({
    onSuccess: () => {
      toast.success("Résident supprimé avec succès");
      setLocation("/residents");
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate({ id: residentId });
  };

  // Handlers pour les notes
  const handleAddNote = () => {
    if (!newNoteContent.trim()) {
      toast.error("Le contenu de la note ne peut pas être vide");
      return;
    }
    createNoteMutation.mutate({
      residentId,
      content: newNoteContent,
      createdBy: "Admin", // TODO: Récupérer le nom de l'utilisateur connecté
    });
  };

  const handleUpdateNote = (noteId: number) => {
    if (!editNoteContent.trim()) {
      toast.error("Le contenu de la note ne peut pas être vide");
      return;
    }
    updateNoteMutation.mutate({
      id: noteId,
      content: editNoteContent,
    });
  };

  const handleDeleteNote = () => {
    if (selectedNoteId) {
      deleteNoteMutation.mutate({ id: selectedNoteId });
    }
  };

  const handleOpenEditDialog = () => {
    if (resident) {
      setEditFirstName(resident.firstName);
      setEditLastName(resident.lastName);
      setEditEmail(resident.email || "");
      setEditPhone(resident.phone || "");
      setEditShelfNumber(resident.shelfNumber || "");
      setEditArtistSignature(resident.artistSignature || null);
      // Réinitialiser les erreurs
      setFirstNameError("");
      setLastNameError("");
      setEmailError("");
      setPhoneError("");
      setShowEditDialog(true);
    }
  };
  
  // Fonctions de validation
  const validateFirstName = (value: string) => {
    if (!value.trim()) {
      setFirstNameError("Le prénom est obligatoire");
      return false;
    }
    setFirstNameError("");
    return true;
  };
  
  const validateLastName = (value: string) => {
    if (!value.trim()) {
      setLastNameError("Le nom est obligatoire");
      return false;
    }
    setLastNameError("");
    return true;
  };
  
  const validateEmail = (value: string) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError("Format d'email invalide");
      return false;
    }
    setEmailError("");
    return true;
  };
  
  const validatePhone = (value: string) => {
    if (value && !/^0[1-9]\d{8}$/.test(value.replace(/\s/g, ""))) {
      setPhoneError("Format de téléphone invalide (ex: 0612345678)");
      return false;
    }
    setPhoneError("");
    return true;
  };
  
  const handleUpdateResident = () => {
    // Valider tous les champs
    const isFirstNameValid = validateFirstName(editFirstName);
    const isLastNameValid = validateLastName(editLastName);
    const isEmailValid = validateEmail(editEmail);
    const isPhoneValid = validatePhone(editPhone);

    // Ne soumettre que si tous les champs sont valides
    if (!isFirstNameValid || !isLastNameValid || !isEmailValid || !isPhoneValid) {
      toast.error("Veuillez corriger les erreurs avant de soumettre");
      return;
    }

    updateMutation.mutate({
      id: residentId,
      firstName: editFirstName,
      lastName: editLastName,
      email: editEmail || undefined,
      phone: editPhone || undefined,
      shelfNumber: editShelfNumber || null,
      artistSignature: editArtistSignature,
    });
  };

  // Mutations pour les pointages
  
  const invalidateAttendanceRelated = () => {
    utils.attendances.getByResidentId.invalidate({ residentId });
    utils.packages.getByResidentId.invalidate({ residentId });
    utils.residents.getById.invalidate({ id: residentId });
    utils.residents.getWithActivePackage.invalidate();
  };

  const updateAttendanceMutation = trpc.attendances.update.useMutation({
    onSuccess: () => {
      toast.success("Pointage modifié avec succès");
      invalidateAttendanceRelated();
      setShowEditAttendanceDialog(false);
      setSelectedAttendance(null);
    },
    onError: (error) => {
      // Même en cas d'erreur de dépassement, les données ont été mises à jour
      invalidateAttendanceRelated();
      toast.warning(`${error.message}`, { duration: 8000 });
      setShowEditAttendanceDialog(false);
      setSelectedAttendance(null);
    },
  });

  const deleteAttendanceMutation = trpc.attendances.delete.useMutation({
    onSuccess: () => {
      toast.success("Pointage supprimé avec succès");
      invalidateAttendanceRelated();
      setShowDeleteAttendanceDialog(false);
      setSelectedAttendance(null);
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });
  
  const createAttendanceMutation = trpc.attendances.create.useMutation({
    onSuccess: () => {
      toast.success("Pointage créé avec succès");
      invalidateAttendanceRelated();
      setShowCreateAttendanceDialog(false);
      // Les refs seront réinitialisées à la prochaine ouverture du dialogue
    },
    onError: (error) => {
      // Même en cas d'erreur de dépassement, les données ont été mises à jour
      invalidateAttendanceRelated();
      toast.warning(`${error.message}`, { duration: 8000 });
      setShowCreateAttendanceDialog(false);
    },
  });

  const handleEditAttendance = (attendance: any) => {
    setSelectedAttendance(attendance);
    const checkIn = new Date(attendance.checkInTime);
    const checkOut = attendance.checkOutTime ? new Date(attendance.checkOutTime) : null;
    
    // Fonction pour convertir une date en format datetime-local en tenant compte du fuseau horaire local
    const toLocalDateTimeString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    setEditCheckInTime(toLocalDateTimeString(checkIn));
    // Stocker uniquement l'heure de sortie au format HH:mm
    if (checkOut) {
      const pad = (n: number) => String(n).padStart(2, '0');
      setEditCheckOutTime(`${pad(checkOut.getHours())}:${pad(checkOut.getMinutes())}`);
    } else {
      setEditCheckOutTime("");
    }
    setShowEditAttendanceDialog(true);
  };

  const handleDeleteAttendance = (attendance: any) => {
    setSelectedAttendance(attendance);
    setShowDeleteAttendanceDialog(true);
  };

  const confirmEditAttendance = () => {
    if (!selectedAttendance) return;
    // Reconstruire le datetime de sortie en combinant la date d'arrivée + l'heure de sortie
    let checkOutISO: string | null = null;
    if (editCheckOutTime) {
      const checkInDate = editCheckInTime.slice(0, 10);
      const checkOutDateTime = new Date(`${checkInDate}T${editCheckOutTime}`);
      const checkInDateTime = new Date(editCheckInTime);
      if (checkOutDateTime <= checkInDateTime) {
        toast.error("L'heure de départ doit être postérieure à l'heure d'arrivée");
        return;
      }
      checkOutISO = checkOutDateTime.toISOString();
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
  
  const handleOpenCreateDialog = () => {
    // Pré-remplir avec la date et heure actuelles
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    setShowCreateAttendanceDialog(true);
    
    setCreateCheckInTime(currentDateTime);
    // Pré-remplir l'heure de sortie avec l'heure actuelle (format HH:mm)
    setCreateCheckOutTime(`${hours}:${minutes}`);
  };
  
  const confirmCreateAttendance = () => {
    if (!createCheckInTime) {
      toast.error("L'heure d'arrivée est obligatoire");
      return;
    }
    // Reconstruire le datetime de sortie en combinant la date d'arrivée + l'heure de sortie
    let checkOutISO: string | null = null;
    if (createCheckOutTime && createCheckOutTime.trim().length > 0) {
      const checkInDate = createCheckInTime.slice(0, 10);
      const checkOutDateTime = new Date(`${checkInDate}T${createCheckOutTime}`);
      const checkInDateTime = new Date(createCheckInTime);
      if (checkOutDateTime <= checkInDateTime) {
        toast.error("L'heure de départ doit être postérieure à l'heure d'arrivée");
        return;
      }
      checkOutISO = checkOutDateTime.toISOString();
    }
    createAttendanceMutation.mutate({
      residentId,
      checkInTime: new Date(createCheckInTime).toISOString(),
      checkOutTime: checkOutISO,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Chargement...</p>
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg">Résident introuvable</p>
        <Button onClick={() => setLocation("/residents")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la liste
        </Button>
      </div>
    );
  }

  // Calculer les informations du forfait
  const getRemainingHours = () => {
    if (!activePackage) return { hours: "Aucun forfait", isExhausted: false };
    const remainingMinutes = activePackage.totalHours - activePackage.usedHours;
    // On affiche 0 si les heures sont épuisées ou dépassées (jamais de valeur négative)
    const clampedMinutes = Math.max(0, remainingMinutes);
    const hours = Math.floor(clampedMinutes / 60);
    const minutes = clampedMinutes % 60;
    return {
      hours: `${hours}h${minutes.toString().padStart(2, "0")}`,
      isExhausted: remainingMinutes <= 0,
    };
  };

  const getPackageBadgeVariant = () => {
    if (!activePackage || !activePackage.endDate) return "outline";
    const endDate = new Date(activePackage.endDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isExpired = daysUntilExpiry < 0 || activePackage.usedHours >= activePackage.totalHours;
    const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;

    if (isExpired) return "destructive";
    if (isExpiringSoon) return "default";
    return "default";
  };

  const getPackageBadgeClass = () => {
    if (!activePackage || !activePackage.endDate) return "";
    const endDate = new Date(activePackage.endDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;

    if (isExpiringSoon) {
      return "bg-orange-500 hover:bg-orange-600 text-white";
    }
    return "bg-green-500 hover:bg-green-600 text-white";
  };

  const remainingHours = getRemainingHours();

  // Calculer les heures hors forfait (après expiration)
  const getOutOfPackageHours = () => {
    if (!activePackage || !attendances) {
      return { hours: "0h00", totalMinutes: 0 };
    }
    
    const packageEndDate = activePackage.endDate ? new Date(activePackage.endDate) : null;
    const packageTotalHours = activePackage.totalHours;
    const activePackageId = activePackage.id;
    
    const outOfPackageAttendances = attendances.filter((att: any) => {
      if (!att.checkInTime || !att.durationMinutes) return false;
      
      // Ne considérer que les pointages du forfait actif
      // Cela garantit qu'on ne compte les heures hors forfait qu'une seule fois
      if (att.packageId !== activePackageId) return false;
      
      // Vérifier si le pointage est après la date d'expiration
      if (packageEndDate) {
        const checkInDate = new Date(att.checkInTime);
        if (checkInDate > packageEndDate) return true;
      }
      
      // Vérifier si le pointage est après l'épuisement des heures
      // Avec le plafonnement, si packageUsedHours >= packageTotalHours,
      // cela signifie que le forfait est épuisé et que ce pointage
      // est au moins partiellement hors forfait
      if (att.packageTotalHours !== undefined && att.packageUsedHours !== undefined) {
        if (att.packageUsedHours >= att.packageTotalHours) return true;
      }
      
      return false;
    });
    
    const totalMinutes = outOfPackageAttendances.reduce((sum: number, att: any) => sum + (att.durationMinutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return {
      hours: `${hours}h${minutes.toString().padStart(2, '0')}`,
      totalMinutes,
    };
  };

  // Utiliser la valeur du backend au lieu du calcul local pour éviter les incohérences
  const outOfPackageHours = {
    hours: totalOutOfPackageMinutes > 0 
      ? `${Math.floor(totalOutOfPackageMinutes / 60)}h${(totalOutOfPackageMinutes % 60).toString().padStart(2, '0')}`
      : "0h00",
    totalMinutes: totalOutOfPackageMinutes
  };

  return (
    <div className="container mx-auto py-4 md:py-8 space-y-4 md:space-y-6">
      {/* En-tête avec bouton retour */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/residents")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/residents/${residentId}/packages`)}
          >
            <Package className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Gérer les </span>Forfaits
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenEditDialog}
          >
            <Edit className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Modifier</span>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Supprimer</span>
          </Button>
        </div>
      </div>

      {/* Onglets Informations / Historique */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="informations">Informations</TabsTrigger>
          <TabsTrigger value="pointages">Historique des Pointages</TabsTrigger>
          <TabsTrigger value="emails">Historique des E-mails</TabsTrigger>
        </TabsList>

        {/* Onglet Informations */}
        <TabsContent value="informations">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne gauche */}
            <div className="space-y-6">
          {/* Informations principales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {resident.firstName} {resident.lastName}
              </CardTitle>
              <CardDescription>Informations du résident</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p>{resident.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Téléphone</p>
                  <p>{resident.phone || "Non renseigné"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Statut</p>
                  <Badge variant={resident.isActive ? "default" : "secondary"}>
                    {resident.isActive ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date d'inscription</p>
                  <p>
                    {new Date(resident.createdAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Étagère</p>
                  <p>{resident.shelfNumber || "Non attribuée"}</p>
                </div>
              </div>
              {resident.artistSignature && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Signature artistique</p>
                  <div className="border rounded-lg overflow-hidden bg-white inline-block">
                    <img
                      src={resident.artistSignature}
                      alt="Signature artistique"
                      className="max-w-full"
                      style={{ maxHeight: 160 }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Forfait actif */}
          <Card>
            <CardHeader>
              <CardTitle>Forfait Actif</CardTitle>
              <CardDescription>Informations sur le forfait en cours</CardDescription>
            </CardHeader>
            <CardContent>
              {latestPackage ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {(() => {
                      // Vérifier si le forfait est expiré par date
                      const isExpiredByDate = latestPackage.endDate && new Date(latestPackage.endDate) < new Date();
                      const isExpired = remainingHours.isExhausted || isExpiredByDate;
                      
                      if (isExpired) {
                        return <Badge variant="destructive">Forfait expiré</Badge>;
                      }
                      return (
                        <Badge
                          variant={getPackageBadgeVariant()}
                          className={getPackageBadgeClass()}
                        >
                          {getPackageLabel(latestPackage.packageType)}
                        </Badge>
                      );
                    })()}
                  </div>
{/* Afficher le cumul des heures hors forfait */}
                  {totalOutOfPackageMinutes > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-red-600">Cumul heures hors forfait</p>
                      <p className="text-2xl font-bold text-red-600">
                        {Math.floor(totalOutOfPackageMinutes / 60)}h{String(totalOutOfPackageMinutes % 60).padStart(2, '0')}
                      </p>
                      <p className="text-xs text-red-500 mt-1">
                        Ces heures seront déduites du prochain forfait
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Heures restantes</p>
                      <p className="text-2xl font-bold">{remainingHours.hours}</p>
                    </div>
                    {outOfPackageHours.totalMinutes > 0 && (
                      <div>
                        <p className="text-sm font-medium text-red-600">Heures hors forfait</p>
                        <p className="text-2xl font-bold text-red-600">{outOfPackageHours.hours}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Date de début</p>
                      <p>
                        {latestPackage.startDate ? (
                          new Date(latestPackage.startDate).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        ) : (
                          <span className="text-muted-foreground italic">En attente</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Date de fin</p>
                      <p>
                        {latestPackage.endDate ? (
                          new Date(latestPackage.endDate).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        ) : (
                          <span className="text-muted-foreground italic">En attente</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Aucun forfait actif</p>
              )}
            </CardContent>
          </Card>
            </div>

            {/* Colonne droite : Notes */}
            <div>
          {/* Notes et Commentaires */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Notes et Commentaires</CardTitle>
                  <CardDescription>Historique des notes sur ce résident</CardDescription>
                </div>
                <Button onClick={() => setShowAddNoteDialog(true)}>
                  Ajouter une note
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {notesLoading ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : notes && notes.length > 0 ? (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {editingNoteId === note.id ? (
                            <textarea
                              value={editNoteContent}
                              onChange={(e) => setEditNoteContent(e.target.value)}
                              className="w-full min-h-[100px] p-2 border rounded-md"
                            />
                          ) : (
                            <p className="whitespace-pre-wrap">{note.content}</p>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          {editingNoteId === note.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleUpdateNote(note.id)}
                              >
                                Enregistrer
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditNoteContent("");
                                }}
                              >
                                Annuler
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditNoteContent(note.content);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedNoteId(note.id);
                                  setShowDeleteNoteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Par {note.createdBy} le {new Date(note.createdAt).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {note.updatedAt && new Date(note.updatedAt).getTime() !== new Date(note.createdAt).getTime() && (
                          <span> (modifié le {new Date(note.updatedAt).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucune note pour ce résident</p>
              )}
            </CardContent>
          </Card>
            </div>
          </div>
        </TabsContent>

        {/* Onglet Historique des Pointages */}
        <TabsContent value="pointages">
          <AttendanceTab
            attendances={attendances || []}
            packages={packages || []}
            isLoading={isLoadingAttendances}
          />
        </TabsContent>

        {/* Onglet Historique des E-mails */}
        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle>Historique des E-mails</CardTitle>
              <CardDescription>
                Tous les e-mails envoyés à ce résident
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailLogsLoading ? (
                <p className="text-muted-foreground">Chargement...</p>
              ) : emailLogs && emailLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sujet</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.sentAt).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.emailType === "reminder" ? "default" : log.emailType === "expiration" ? "destructive" : "secondary"}>
                            {log.emailType === "reminder" ? "Rappel" : log.emailType === "expiration" ? "Expiration" : log.emailType}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.subject}</TableCell>
                        <TableCell>
                          <Badge variant={log.success ? "outline" : "destructive"}>
                            {log.success ? "Envoyé" : "Échec"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">Aucun e-mail envoyé</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogue de confirmation de suppression */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer {resident.firstName} {resident.lastName} ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de modification de pointage */}
      <Dialog open={showEditAttendanceDialog} onOpenChange={setShowEditAttendanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le pointage</DialogTitle>
            <DialogDescription>
              Modifiez les heures d'arrivée et de départ du pointage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Heure d'arrivée</label>
              <input
                type="datetime-local"
                value={editCheckInTime}
                onChange={(e) => {
                  const newCheckIn = e.target.value;
                  setEditCheckInTime(newCheckIn);
                  if (editCheckOutTime && newCheckIn) {
                    if (editCheckOutTime.slice(0, 10) !== newCheckIn.slice(0, 10))
                      setEditCheckOutTime("");
                  }
                }}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Heure de départ</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="time"
                  value={editCheckOutTime}
                  onChange={(e) => setEditCheckOutTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
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
            <Button variant="outline" onClick={() => setShowEditAttendanceDialog(false)}>
              Annuler
            </Button>
            <Button onClick={confirmEditAttendance}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de suppression de pointage */}
      <Dialog open={showDeleteAttendanceDialog} onOpenChange={setShowDeleteAttendanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce pointage ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAttendanceDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDeleteAttendance}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialogue de création de pointage */}
      <Dialog open={showCreateAttendanceDialog} onOpenChange={setShowCreateAttendanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un pointage</DialogTitle>
            <DialogDescription>
              Créez un nouveau pointage pour ce résident
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Heure d'arrivée *</label>
              <input
                type="datetime-local"
                value={createCheckInTime}
                onChange={(e) => {
                  const newCheckIn = e.target.value;
                  setCreateCheckInTime(newCheckIn);
                  if (createCheckOutTime && newCheckIn) {
                    if (createCheckOutTime.slice(0, 10) !== newCheckIn.slice(0, 10))
                      setCreateCheckOutTime("");
                  }
                }}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Heure de départ</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="time"
                  value={createCheckOutTime}
                  onChange={(e) => setCreateCheckOutTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
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
            <Button variant="outline" onClick={() => setShowCreateAttendanceDialog(false)}>
              Annuler
            </Button>
            <Button onClick={confirmCreateAttendance}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de modification des informations */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier les informations</DialogTitle>
            <DialogDescription>
              Modifiez les informations du résident
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Prénom *</label>
              <input
                type="text"
                value={editFirstName}
                onChange={(e) => {
                  setEditFirstName(e.target.value);
                  validateFirstName(e.target.value);
                }}
                onBlur={(e) => validateFirstName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  firstNameError ? "border-red-500" : ""
                }`}
                required
              />
              {firstNameError && (
                <p className="text-sm text-red-500 mt-1">{firstNameError}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Nom *</label>
              <input
                type="text"
                value={editLastName}
                onChange={(e) => {
                  setEditLastName(e.target.value);
                  validateLastName(e.target.value);
                }}
                onBlur={(e) => validateLastName(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  lastNameError ? "border-red-500" : ""
                }`}
                required
              />
              {lastNameError && (
                <p className="text-sm text-red-500 mt-1">{lastNameError}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => {
                  setEditEmail(e.target.value);
                  validateEmail(e.target.value);
                }}
                onBlur={(e) => validateEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  emailError ? "border-red-500" : ""
                }`}
                placeholder="email@example.com"
              />
              {emailError && (
                <p className="text-sm text-red-500 mt-1">{emailError}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Téléphone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => {
                  setEditPhone(e.target.value);
                  validatePhone(e.target.value);
                }}
                onBlur={(e) => validatePhone(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  phoneError ? "border-red-500" : ""
                }`}
                placeholder="0612345678"
              />
              {phoneError && (
                <p className="text-sm text-red-500 mt-1">{phoneError}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Étagère (optionnel)</label>
              <input
                type="text"
                value={editShelfNumber}
                onChange={(e) => setEditShelfNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-md mt-1"
                placeholder="Ex: A3, 12, B-7"
                maxLength={20}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Signature artistique (optionnel)</label>
              <SignaturePad
                value={editArtistSignature}
                onChange={(sig) => setEditArtistSignature(sig)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateResident}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue Ajouter une note */}
      <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une note</DialogTitle>
            <DialogDescription>
              Ajoutez un commentaire ou une note sur ce résident
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Contenu</label>
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="w-full min-h-[150px] p-2 border rounded-md mt-1"
                placeholder="Entrez votre note ici..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNoteDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddNote}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue Supprimer une note */}
      <Dialog open={showDeleteNoteDialog} onOpenChange={setShowDeleteNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la note</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette note ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteNoteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteNote}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}

// Palette de couleurs pour les forfaits (identique à ResidentPackages)
const PROFILE_PACKAGE_COLORS = [
  { bg: 'bg-blue-50',    border: 'border-blue-300',    dot: 'bg-blue-400',    label: 'text-blue-700'    },
  { bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-400', label: 'text-emerald-700' },
  { bg: 'bg-violet-50',  border: 'border-violet-300',  dot: 'bg-violet-400',  label: 'text-violet-700'  },
  { bg: 'bg-amber-50',   border: 'border-amber-300',   dot: 'bg-amber-400',   label: 'text-amber-700'   },
  { bg: 'bg-rose-50',    border: 'border-rose-300',    dot: 'bg-rose-400',    label: 'text-rose-700'    },
  { bg: 'bg-cyan-50',    border: 'border-cyan-300',    dot: 'bg-cyan-400',    label: 'text-cyan-700'    },
  { bg: 'bg-orange-50',  border: 'border-orange-300',  dot: 'bg-orange-400',  label: 'text-orange-700'  },
  { bg: 'bg-teal-50',    border: 'border-teal-300',    dot: 'bg-teal-400',    label: 'text-teal-700'    },
];

function AttendanceTab({
  attendances,
  packages,
  isLoading,
}: {
  attendances: any[];
  packages: any[];
  isLoading: boolean;
}) {
  // Associer chaque forfait (trié par id croissant) à une couleur
  const packageColorMap = useMemo(() => {
    const sorted = [...packages].sort((a, b) => a.id - b.id);
    const map = new Map<number, typeof PROFILE_PACKAGE_COLORS[0]>();
    sorted.forEach((pkg, i) => {
      map.set(pkg.id, PROFILE_PACKAGE_COLORS[i % PROFILE_PACKAGE_COLORS.length]);
    });
    return map;
  }, [packages]);

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatTime = (date: Date | string) =>
    new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    return `${Math.floor(minutes / 60)}h${(minutes % 60).toString().padStart(2, '0')}`;
  };

  const sorted = [...attendances].sort(
    (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des Pointages</CardTitle>
        <CardDescription>Tous les pointages passés et actuels</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Chargement...</p>
        ) : sorted.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Arrivée</TableHead>
                  <TableHead>Départ</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((att) => {
                  const isAdjustAdd = att.attendanceType === 'adjustment_add';
                  const isAdjustSubtract = att.attendanceType === 'adjustment_subtract';
                  const isAdjustment = isAdjustAdd || isAdjustSubtract;
                  const isOutOfPackage = !isAdjustment && !!att.isOutOfPackage;
                  const attColor = att.packageId ? packageColorMap.get(att.packageId) : undefined;
                  const rowBg = isAdjustAdd
                    ? 'bg-purple-50'
                    : isAdjustSubtract
                    ? 'bg-orange-50'
                    : attColor
                    ? attColor.bg
                    : '';

                  const today = new Date();
                  const isToday =
                    new Date(att.checkInTime).toDateString() === today.toDateString();

                  return (
                    <TableRow key={att.id} className={rowBg}>
                      {/* Date */}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isAdjustAdd && (
                            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 bg-purple-400" />
                          )}
                          {isAdjustSubtract && (
                            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 bg-orange-400" />
                          )}
                          {!isAdjustment && (
                            <span
                              className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                attColor?.dot ?? 'bg-gray-300'
                              }`}
                            />
                          )}
                          <span className={isAdjustment ? 'italic text-purple-700' : ''}>
                            {formatDate(att.checkInTime)}
                            {isToday && (
                              <span className="ml-2 text-xs font-semibold text-gray-600">
                                Aujourd'hui
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>

                      {/* Arrivée */}
                      <TableCell>
                        {isAdjustment ? (
                          <span className="text-muted-foreground text-xs italic">—</span>
                        ) : (
                          formatTime(att.checkInTime)
                        )}
                      </TableCell>

                      {/* Départ */}
                      <TableCell>
                        {isAdjustment ? (
                          <span className="text-muted-foreground text-xs italic">—</span>
                        ) : att.checkOutTime ? (
                          formatTime(att.checkOutTime)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* Durée */}
                      <TableCell>
                        {att.durationMinutes ? (
                          <span
                            className={`font-medium ${
                              isAdjustAdd
                                ? 'text-purple-700'
                                : isAdjustSubtract
                                ? 'text-orange-700'
                                : isOutOfPackage
                                ? 'text-red-600'
                                : ''
                            }`}
                          >
                            {isAdjustAdd && '+'}
                            {isAdjustSubtract && '-'}
                            {formatDuration(att.durationMinutes)}
                            {isOutOfPackage && !isAdjustment && (
                              <span className="ml-1 text-xs">(Hors forfait)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* Statut */}
                      <TableCell>
                        {isAdjustment ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                              isAdjustAdd
                                ? 'bg-purple-50 text-purple-700 ring-purple-600/20'
                                : 'bg-orange-50 text-orange-700 ring-orange-600/20'
                            }`}
                          >
                            {isAdjustAdd ? '+ Ajout atelier' : '- Retrait atelier'}
                          </span>
                        ) : att.checkOutTime ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                            Terminé
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                            En cours
                          </span>
                        )}
                      </TableCell>


                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground">Aucun pointage trouvé</p>
        )}
      </CardContent>
    </Card>
  );
}
