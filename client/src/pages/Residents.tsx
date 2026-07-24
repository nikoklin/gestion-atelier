import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { usePackageLabel } from "@/hooks/usePackageLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Edit, UserX, Package, Mail, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { formatMinutesAsHours } from "@/../../shared/packageHelpers";
import type { Resident } from "@/../../drizzle/schema";

export default function Residents() {
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    shelfNumber: "",
    artistSignature: null as string | null,
  });
  const [formErrors, setFormErrors] = useState<{ firstName?: boolean; lastName?: boolean; email?: boolean }>({}); 
  const utils = trpc.useUtils();
  const { data: residentsData, isLoading } = trpc.residents.getWithActivePackage.useQuery(undefined, {
    refetchInterval: 2 * 60 * 1000, // Rafraîchissement automatique toutes les 2 minutes
  });
  // Les heures hors forfait sont maintenant stockées directement dans resident.outOfPackageMinutes

  // Étagères disponibles : exclure l'étagère du résident en cours de modification
  const { data: shelvesData } = trpc.atelierSettings.getAvailableShelves.useQuery(
    { excludeResidentId: selectedResident?.id },
    { enabled: isCreateDialogOpen || isEditDialogOpen }
  );

  const [searchQuery, setSearchQuery] = useState("");

  type SortField = "firstName" | "lastName" | "presence" | "packageType" | "remainingMinutes" | "endDate";
  type SortDirection = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("firstName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40 inline" />;
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 inline" />;
  };
  
  const sendReminderMutation = trpc.email.sendReminderToResident.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        // Rafraîchir les données pour mettre à jour le bouton
        utils.residents.getWithActivePackage.invalidate();
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
  
  // Filtrer par recherche (prénom, nom, e-mail) puis trier selon le champ et la direction sélectionnés
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredResidents = residentsData?.filter((r) =>
    !normalizedQuery ||
    r.firstName.toLowerCase().includes(normalizedQuery) ||
    r.lastName.toLowerCase().includes(normalizedQuery) ||
    r.email?.toLowerCase().includes(normalizedQuery)
  );
  const residents = filteredResidents ? [...filteredResidents].sort((a, b) => {
    let valA: string | number;
    let valB: string | number;

    if (sortField === "firstName") {
      valA = a.firstName.toLowerCase();
      valB = b.firstName.toLowerCase();
    } else if (sortField === "lastName") {
      valA = a.lastName.toLowerCase();
      valB = b.lastName.toLowerCase();
    } else if (sortField === "packageType") {
      valA = a.activePackage?.packageType ?? "";
      valB = b.activePackage?.packageType ?? "";
    } else if (sortField === "remainingMinutes") {
      const remA = a.activePackage ? Math.max(0, a.activePackage.totalHours - a.activePackage.usedHours) : -1;
      const remB = b.activePackage ? Math.max(0, b.activePackage.totalHours - b.activePackage.usedHours) : -1;
      valA = remA;
      valB = remB;
    } else if (sortField === "presence") {
      valA = a.hasOpenAttendance ? 1 : 0;
      valB = b.hasOpenAttendance ? 1 : 0;
    } else if (sortField === "endDate") {
      valA = a.activePackage?.endDate ? new Date(a.activePackage.endDate).getTime() : 0;
      valB = b.activePackage?.endDate ? new Date(b.activePackage.endDate).getTime() : 0;
    } else {
      valA = a.firstName.toLowerCase();
      valB = b.firstName.toLowerCase();
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  }) : undefined;



  const createMutation = trpc.residents.create.useMutation({
    onSuccess: (data) => {
      toast.success("Résident créé avec succès");
      setIsCreateDialogOpen(false);
      setFormErrors({});
      setFormData({ firstName: "", lastName: "", email: "", phone: "", shelfNumber: "", artistSignature: null });
      utils.residents.getWithActivePackage.invalidate();
    },
    onError: (error) => {
      // Tronquer le message pour éviter d'afficher du Base64 ou des données brutes
      const msg = error.message?.length > 200 ? "Erreur de validation des données. Vérifiez les champs saisis." : error.message;
      toast.error("Erreur lors de la création: " + msg);
    },
  });

  const updateMutation = trpc.residents.update.useMutation({
    onSuccess: () => {
      toast.success("Résident modifié avec succès");
      setIsEditDialogOpen(false);
      setSelectedResident(null);
      utils.residents.getWithActivePackage.invalidate();
    },
    onError: (error) => {
      toast.error("Erreur lors de la modification: " + error.message);
    },
  });

  const deleteMutation = trpc.residents.delete.useMutation({
    onSuccess: () => {
      toast.success("Résident désactivé avec succès");
      utils.residents.getWithActivePackage.invalidate();
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression: " + error.message);
    },
  });

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleCreate = () => {
    const errors: { firstName?: boolean; lastName?: boolean; email?: boolean } = {};
    if (!formData.firstName.trim()) errors.firstName = true;
    if (!formData.lastName.trim()) errors.lastName = true;
    if (formData.email && !isValidEmail(formData.email)) errors.email = true;
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    createMutation.mutate(formData);
  };

  const handleEdit = () => {
    if (selectedResident) {
      updateMutation.mutate({
        id: selectedResident.id,
        ...formData,
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir désactiver ce résident ?")) {
      deleteMutation.mutate({ id });
    }
  };

  const openEditDialog = (resident: any) => {
    setSelectedResident(resident);
    setFormData({
      firstName: resident.firstName,
      lastName: resident.lastName,
      email: resident.email,
      phone: resident.phone || "",
      shelfNumber: resident.shelfNumber || "",
      artistSignature: resident.artistSignature || null,
    });
    setIsEditDialogOpen(true);
  };


  const { getPackageLabel } = usePackageLabel();

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("fr-FR");
  };

  const getRemainingHours = (pkg: any) => {
    if (!pkg) return { display: "Aucun forfait", isExhausted: false };
    const remainingMinutes = pkg.totalHours - pkg.usedHours;
    // Plafonner à 0 : on n'affiche jamais de valeur négative
    const clamped = Math.max(0, remainingMinutes);
    const hours = Math.floor(clamped / 60);
    const minutes = clamped % 60;
    const display = `${hours}h${minutes > 0 ? minutes.toString().padStart(2, "0") : "00"}`;
    const isExhausted = remainingMinutes <= 0;
    return { display, isExhausted };
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
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Gestion des Résidents</CardTitle>
              <CardDescription className="hidden sm:block">Liste de tous les résidents de l'atelier</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Rechercher un résident..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[200px] sm:w-[260px]"
                />
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau Résident
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("firstName")}
                >
                  Prénom <SortIcon field="firstName" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("lastName")}
                >
                  Nom <SortIcon field="lastName" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("presence")}
                >
                  Présence <SortIcon field="presence" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("packageType")}
                >
                  Forfait Actif <SortIcon field="packageType" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("remainingMinutes")}
                >
                  Heures Restantes <SortIcon field="remainingMinutes" />
                </TableHead>
                <TableHead className="hidden lg:table-cell">Heures Hors Forfait</TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("endDate")}
                >
                  Fin de Validité <SortIcon field="endDate" />
                </TableHead>
                <TableHead className="hidden sm:table-cell">Étagère</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residents?.map((resident) => (
                <TableRow 
                  key={resident.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setLocation(`/residents/${resident.id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {resident.firstName}
                      {resident.hasMissedCheckout && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const attendanceId = resident.missedCheckoutAttendanceId;
                                if (attendanceId) {
                                  setLocation(`/residents/${resident.id}?openAttendance=${attendanceId}`);
                                } else {
                                  setLocation(`/residents/${resident.id}?tab=pointages`);
                                }
                              }}
                              className="inline-flex items-center hover:opacity-70 transition-opacity"
                            >
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ce résident a oublié de pointer en partant. Cliquez pour corriger le pointage.</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{resident.lastName}</TableCell>
                  <TableCell>
                    {resident.hasOpenAttendance ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center w-6 h-6">
                            <span className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-300 animate-pulse" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Pointage en cours</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6">
                        <span className="w-3 h-3 rounded-full bg-muted-foreground/20" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      if (!resident.activePackage) {
                        return "-";
                      }
                      const remaining = getRemainingHours(resident.activePackage);
                      
                      // Vérifier si le forfait est expiré par date
                      const isExpiredByDate = resident.activePackage.endDate && new Date(resident.activePackage.endDate) < new Date();
                      
                      if (remaining.isExhausted || isExpiredByDate) {
                        return (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                            Forfait expiré
                          </span>
                        );
                      }
                      // Vérifier si le forfait expire dans 7 jours
                      if (!resident.activePackage.endDate) {
                        return (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                            {getPackageLabel(resident.activePackage.packageType)}
                          </span>
                        );
                      }
                      const endDate = new Date(resident.activePackage.endDate);
                      const today = new Date();
                      const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
                      
                      if (isExpiringSoon) {
                        return (
                          <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                            {getPackageLabel(resident.activePackage.packageType)}
                          </span>
                        );
                      }
                      
                      return (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          {getPackageLabel(resident.activePackage.packageType)}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{getRemainingHours(resident.activePackage).display}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {(() => {
                      const outOfPackageMinutes = resident.outOfPackageMinutes || 0;
                      if (outOfPackageMinutes === 0) {
                        return <span className="text-muted-foreground">-</span>;
                      }
                      return (
                        <span className="text-red-600 font-medium">
                          {formatMinutesAsHours(outOfPackageMinutes)}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell whitespace-nowrap">
                    {resident.activePackage && resident.activePackage.endDate ? formatDate(resident.activePackage.endDate) : "-"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-center">
                    {resident.shelfNumber ? (
                      <span className="inline-flex items-center justify-center rounded bg-muted text-xs font-medium px-2 py-0.5">
                        {resident.shelfNumber}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      if (!resident.activePackage || !resident.activePackage.endDate) return null;
                      
                      const endDate = new Date(resident.activePackage.endDate);
                      const today = new Date();
                      const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const isExpired = daysUntilExpiry < 0;
                      const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
                      const remaining = getRemainingHours(resident.activePackage);
                      const isExhausted = remaining.isExhausted;
                      
                      // Déterminer la variante du bouton et la classe CSS
                      let variant: "destructive" | "outline" = "outline";
                      let buttonClass = "";
                      let shouldShowButton = false;
                      
                      if (isExpired || isExhausted) {
                        // Afficher le bouton rouge uniquement si l'e-mail d'expiration n'a pas été envoyé
                        const emailSent = resident.activePackage.expirationEmailSent;
                        if (!emailSent) {
                          shouldShowButton = true;
                          variant = "destructive";
                        }
                      } else if (isExpiringSoon) {
                        // Afficher le bouton orange seulement si le rappel n'a pas été envoyé
                        if (!resident.activePackage.reminderSent) {
                          shouldShowButton = true;
                          variant = "outline";
                          buttonClass = "!bg-orange-500 hover:!bg-orange-600 !text-white !border-orange-500";
                        }
                      }
                      
                      // Ne pas afficher le bouton si shouldShowButton = false
                      if (!shouldShowButton) return null;
                      
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={variant}
                              size="sm"
                              className={buttonClass}
                              onClick={() => {
                                sendReminderMutation.mutate({ residentId: resident.id });
                              }}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {resident.lastReminderDate
                              ? `Dernier rappel : ${new Date(resident.lastReminderDate).toLocaleDateString("fr-FR")}`
                              : "Envoyer un e-mail de rappel"}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de création */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) setFormErrors({}); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau Résident</DialogTitle>
            <DialogDescription>Ajouter un nouveau résident à l'atelier</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName" className={formErrors.firstName ? "text-red-600" : ""}>
                Prénom <span className="text-red-500">*</span>
              </Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => { setFormData({ ...formData, firstName: e.target.value }); if (e.target.value.trim()) setFormErrors(prev => ({ ...prev, firstName: false })); }}
                className={formErrors.firstName ? "border-red-500 focus-visible:ring-red-500" : ""}
                placeholder="Prénom"
              />
              {formErrors.firstName && <p className="text-xs text-red-600">Le prénom est obligatoire</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName" className={formErrors.lastName ? "text-red-600" : ""}>
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => { setFormData({ ...formData, lastName: e.target.value }); if (e.target.value.trim()) setFormErrors(prev => ({ ...prev, lastName: false })); }}
                className={formErrors.lastName ? "border-red-500 focus-visible:ring-red-500" : ""}
                placeholder="Nom"
              />
              {formErrors.lastName && <p className="text-xs text-red-600">Le nom est obligatoire</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email" className={formErrors.email ? "text-red-600" : ""}>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => { setFormData({ ...formData, email: e.target.value }); if (isValidEmail(e.target.value) || !e.target.value) setFormErrors(prev => ({ ...prev, email: false })); }}
                className={formErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
                placeholder="exemple@email.com"
              />
              {formErrors.email && <p className="text-xs text-red-600">Adresse email invalide</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shelfNumber">Étagère (optionnel)</Label>
              {shelvesData && shelvesData.total > 0 ? (
                <Select
                  value={formData.shelfNumber || "none"}
                  onValueChange={(v) => setFormData({ ...formData, shelfNumber: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="shelfNumber">
                    <SelectValue placeholder="Choisir une étagère..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {shelvesData.available.map((n) => (
                      <SelectItem key={n} value={String(n)}>Étagère {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="shelfNumber"
                  placeholder="Ex: 12"
                  value={formData.shelfNumber}
                  onChange={(e) => setFormData({ ...formData, shelfNumber: e.target.value })}
                />
              )}
              {shelvesData && shelvesData.total > 0 && shelvesData.available.length === 0 && (
                <p className="text-xs text-amber-600">Toutes les étagères sont occupées.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Signature artistique (optionnel)</Label>
              <SignaturePad
                value={formData.artistSignature}
                onChange={(sig) => setFormData({ ...formData, artistSignature: sig })}
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

      {/* Dialog de modification */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier Résident</DialogTitle>
            <DialogDescription>Modifier les informations du résident</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-firstName">Prénom</Label>
              <Input
                id="edit-firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-lastName">Nom</Label>
              <Input
                id="edit-lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Téléphone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-shelfNumber">Étagère (optionnel)</Label>
              {shelvesData && shelvesData.total > 0 ? (
                <Select
                  value={formData.shelfNumber || "none"}
                  onValueChange={(v) => setFormData({ ...formData, shelfNumber: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="edit-shelfNumber">
                    <SelectValue placeholder="Choisir une étagère..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {/* Étagère actuelle du résident (non disponible pour les autres) */}
                    {formData.shelfNumber && !shelvesData.available.includes(Number(formData.shelfNumber)) && (
                      <SelectItem value={formData.shelfNumber}>Étagère {formData.shelfNumber} (actuelle)</SelectItem>
                    )}
                    {shelvesData.available.map((n) => (
                      <SelectItem key={n} value={String(n)}>Étagère {n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="edit-shelfNumber"
                  placeholder="Ex: 12"
                  value={formData.shelfNumber}
                  onChange={(e) => setFormData({ ...formData, shelfNumber: e.target.value })}
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label>Signature artistique (optionnel)</Label>
              <SignaturePad
                value={formData.artistSignature}
                onChange={(sig) => setFormData({ ...formData, artistSignature: sig })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}
