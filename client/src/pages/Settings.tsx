import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Settings as SettingsIcon, Mail, Clock, Download, Layers, Package, Plus, Pencil, Trash2, Check, X, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportEmail, setExportEmail] = useState("");
  const [isSendingExport, setIsSendingExport] = useState(false);
  const [totalShelvesInput, setTotalShelvesInput] = useState("");
  const [reminderDaysInput, setReminderDaysInput] = useState("7");
  const [guideEmailEnabled, setGuideEmailEnabled] = useState(true);

  // Liens de paiement
  type PaymentLink = { label: string; url: string };
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [editingLinkIdx, setEditingLinkIdx] = useState<number | null>(null);
  const [editLinkLabel, setEditLinkLabel] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");

  const { data: atelierSettings } = trpc.atelierSettings.get.useQuery();

  useEffect(() => {
    if (atelierSettings) {
      setTotalShelvesInput(String(atelierSettings.totalShelves));
      setReminderDaysInput(String(atelierSettings.reminderDaysBeforeExpiry ?? 7));
      setGuideEmailEnabled(atelierSettings.guideEmailEnabled ?? true);
      // Charger les liens de paiement
      if (atelierSettings.paymentLinks) {
        try {
          const parsed = JSON.parse(atelierSettings.paymentLinks) as { links: PaymentLink[] };
          setPaymentLinks(parsed.links ?? []);
        } catch { setPaymentLinks([]); }
      } else {
        setPaymentLinks([]);
      }
    }
  }, [atelierSettings]);

  const utils = trpc.useUtils();
  const updateAtelierSettingsMutation = trpc.atelierSettings.update.useMutation({
    onSuccess: () => {
      toast.success("Paramètres sauvegardés");
      utils.atelierSettings.get.invalidate();
    },
    onError: (error) => {
      toast.error("Erreur", { description: error.message });
    },
  });

  const handleSaveShelves = () => {
    const n = parseInt(totalShelvesInput, 10);
    if (isNaN(n) || n < 0) {
      toast.error("Valeur invalide", { description: "Veuillez entrer un nombre entier positif." });
      return;
    }
    updateAtelierSettingsMutation.mutate({ totalShelves: n });
  };

  const handleSaveReminderDays = () => {
    const n = parseInt(reminderDaysInput, 10);
    if (isNaN(n) || n < 1 || n > 30) {
      toast.error("Valeur invalide", { description: "Entrez un nombre entre 1 et 30." });
      return;
    }
    updateAtelierSettingsMutation.mutate({ reminderDaysBeforeExpiry: n });
  };

  const handleToggleGuideEmail = (enabled: boolean) => {
    setGuideEmailEnabled(enabled);
    updateAtelierSettingsMutation.mutate({ guideEmailEnabled: enabled });
  };
  
  const sendExportMutation = trpc.email.sendDataExport.useMutation({
    onSuccess: () => {
      toast.success("Export envoyé", {
        description: `Les données ont été envoyées à ${exportEmail}`,
      });
      setIsSendingExport(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de l'envoi", {
        description: error.message,
      });
      setIsSendingExport(false);
    },
  });

  const exportMutation = trpc.export.generateExcel.useMutation({
    onSuccess: (data) => {
      // Convertir le base64 en blob et télécharger
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Export réussi", {
        description: `Le fichier ${data.filename} a été téléchargé`,
      });
      setIsExporting(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de l'export", {
        description: error.message,
      });
      setIsExporting(false);
    },
  });
  
  const handleExport = () => {
    setIsExporting(true);
    exportMutation.mutate();
  };
  
  const handleSendExport = () => {
    if (!exportEmail || !exportEmail.includes('@')) {
      toast.error("E-mail invalide", {
        description: "Veuillez entrer une adresse e-mail valide",
      });
      return;
    }
    setIsSendingExport(true);
    sendExportMutation.mutate({ email: exportEmail });
  };
  
  // ── Types de forfaits ─────────────────────────────────────────────────────
  const { data: packageTypesList, refetch: refetchPackageTypes } = trpc.packageTypes.getAll.useQuery();
  const [pkgDialog, setPkgDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; item?: any }>({
    open: false, mode: 'create'
  });
  const [pkgForm, setPkgForm] = useState({ label: '', hours: '', durationWeeks: '', price: '', isActive: true, sortOrder: '0' });

  const createPkgTypeMutation = trpc.packageTypes.create.useMutation({
    onSuccess: () => { toast.success('Type de forfait créé'); refetchPackageTypes(); setPkgDialog({ open: false, mode: 'create' }); },
    onError: (e) => toast.error('Erreur', { description: e.message }),
  });
  const updatePkgTypeMutation = trpc.packageTypes.update.useMutation({
    onSuccess: () => { toast.success('Type de forfait mis à jour'); refetchPackageTypes(); setPkgDialog({ open: false, mode: 'create' }); },
    onError: (e) => toast.error('Erreur', { description: e.message }),
  });
  const deletePkgTypeMutation = trpc.packageTypes.delete.useMutation({
    onSuccess: () => { toast.success('Type de forfait supprimé'); refetchPackageTypes(); },
    onError: (e) => toast.error('Erreur', { description: e.message }),
  });

  const openCreatePkg = () => {
    setPkgForm({ label: '', hours: '', durationWeeks: '', price: '', isActive: true, sortOrder: '0' });
    setPkgDialog({ open: true, mode: 'create' });
  };
  const openEditPkg = (item: any) => {
    setPkgForm({
      label: item.label,
      hours: String(Math.round(item.totalMinutes / 60)),
      durationWeeks: String(item.durationWeeks),
      price: String(item.price),
      isActive: item.isActive,
      sortOrder: String(item.sortOrder),
    });
    setPkgDialog({ open: true, mode: 'edit', item });
  };
  const handleSavePkg = () => {
    const hours = parseFloat(pkgForm.hours);
    const durationWeeks = parseInt(pkgForm.durationWeeks, 10);
    const price = parseInt(pkgForm.price, 10);
    const sortOrder = parseInt(pkgForm.sortOrder, 10);
    if (!pkgForm.label.trim() || isNaN(hours) || hours <= 0 || isNaN(durationWeeks) || durationWeeks < 1 || isNaN(price) || price < 0) {
      toast.error('Formulaire invalide', { description: 'Veuillez remplir tous les champs correctement.' });
      return;
    }
    const totalMinutes = Math.round(hours * 60);
    if (pkgDialog.mode === 'create') {
      createPkgTypeMutation.mutate({ label: pkgForm.label.trim(), totalMinutes, durationWeeks, price, isActive: pkgForm.isActive, sortOrder: isNaN(sortOrder) ? 0 : sortOrder });
    } else {
      updatePkgTypeMutation.mutate({ id: pkgDialog.item.id, label: pkgForm.label.trim(), totalMinutes, durationWeeks, price, isActive: pkgForm.isActive, sortOrder: isNaN(sortOrder) ? 0 : sortOrder });
    }
  };

  return (
    <div className="container mx-auto py-4 md:py-8 max-w-4xl">
      <div className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground mt-2">
          Configuration du système d'envoi d'e-mails automatiques
        </p>
      </div>

      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <AlertCircle className="h-5 w-5 text-blue-600" />
        <AlertTitle className="text-blue-900 font-semibold">Configuration Requise</AlertTitle>
        <AlertDescription className="text-blue-800">
          Pour activer l'envoi automatique des e-mails de rappel, vous devez configurer les secrets 
          <strong> EMAIL_USER</strong> et <strong> EMAIL_PASSWORD</strong> via l'interface de gestion Manus.
        </AlertDescription>
      </Alert>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Comment Configurer les Secrets
          </CardTitle>
          <CardDescription>
            Suivez ces étapes pour activer l'envoi d'e-mails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold mb-1">Ouvrir le panneau de gestion</h4>
                <p className="text-sm text-muted-foreground">
                  Cliquez sur l'<strong>icône en haut à droite</strong> du panneau de chat (à côté de "Gestion d'Atelier") 
                  pour ouvrir le panneau Management UI à droite de l'écran.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold mb-1">Accéder aux Secrets</h4>
                <p className="text-sm text-muted-foreground">
                  Dans le panneau Management UI, cherchez l'onglet <strong>"Settings"</strong>, 
                  puis cliquez sur <strong>"Secrets"</strong> dans le sous-menu.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold mb-1">Ajouter les secrets</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Ajoutez les deux secrets suivants :
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 border">
                  <div>
                    <p className="text-sm font-mono font-semibold text-gray-700">EMAIL_USER</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Valeur : <code className="bg-white px-2 py-1 rounded border">contact@atourdebras-atelier.com</code>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold text-gray-700">EMAIL_PASSWORD</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Valeur : Votre mot de passe d'application Gmail (16 caractères)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Obtenir un Mot de Passe d'Application Gmail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>Accès direct :</strong> Allez sur{" "}
              <a 
                href="https://myaccount.google.com/apppasswords" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                https://myaccount.google.com/apppasswords
              </a>
            </p>
            
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-2">Étapes détaillées :</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Connectez-vous à votre compte Google</li>
                <li>Activez la <strong>validation en deux étapes</strong> si ce n'est pas déjà fait</li>
                <li>Accédez à "Mots de passe des applications"</li>
                <li>Sélectionnez "Autre (nom personnalisé)"</li>
                <li>Entrez "Gestion Atelier" comme nom</li>
                <li>Cliquez sur "Générer"</li>
                <li>Copiez le mot de passe de 16 caractères affiché</li>
                <li>Collez-le dans le secret EMAIL_PASSWORD</li>
              </ol>
            </div>

            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Important :</strong> La validation en deux étapes doit être activée pour que l'option 
                "Mots de passe des applications" soit disponible.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Sauvegarde des Données
          </CardTitle>
          <CardDescription>
            Exportez ou recevez par e-mail l'historique complet de vos données
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Export Excel */}
            <div>
              <h4 className="font-semibold mb-2">Export Excel (téléchargement)</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Téléchargez un fichier Excel contenant l'historique des pointages et forfaits.
              </p>
              <Button 
                onClick={handleExport}
                disabled={isExporting}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Export en cours..." : "Télécharger l'export Excel"}
              </Button>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Export automatique quotidien par e-mail (CSV)
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                Recevez automatiquement chaque jour par e-mail toutes vos données au format CSV :
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4 mb-4">
                <li>Liste complète des résidents</li>
                <li>Tous les forfaits (actifs et expirés)</li>
                <li>Historique complet des pointages</li>
                <li>Historique des e-mails envoyés</li>
              </ul>

              <Alert className="bg-blue-50 border-blue-200 mb-4">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                  <strong>Envoi automatique :</strong> Les fichiers CSV seront envoyés automatiquement tous les jours à 23h00 à l'adresse e-mail configurée (EMAIL_USER).
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Envoyer un export manuel maintenant
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="adresse@exemple.com"
                      value={exportEmail}
                      onChange={(e) => setExportEmail(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <Button 
                      onClick={handleSendExport}
                      disabled={isSendingExport}
                      className="flex items-center gap-2 whitespace-nowrap"
                    >
                      <Mail className="h-4 w-4" />
                      {isSendingExport ? "Envoi..." : "Envoyer"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Les fichiers CSV seront envoyés en pièces jointes à cette adresse
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Étagères de l'Atelier
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Indiquez le nombre total d'étagères disponibles pour les résidents. Cette information est utilisée sur le tableau de bord pour afficher les étagères libres.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 max-w-xs">
            <Input
              type="number"
              min={0}
              max={500}
              value={totalShelvesInput}
              onChange={(e) => setTotalShelvesInput(e.target.value)}
              placeholder="Ex : 20"
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">étagères au total</span>
            <Button onClick={handleSaveShelves} disabled={updateAtelierSettingsMutation.isPending} size="sm">
              {updateAtelierSettingsMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
          {atelierSettings && (
            <p className="text-xs text-muted-foreground mt-2">
              Valeur actuelle : <strong>{atelierSettings.totalShelves}</strong> étagère{atelierSettings.totalShelves > 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Types de forfaits ── */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Types de Forfaits
              </CardTitle>
              <CardDescription className="mt-1">
                Créez et gérez les types de forfaits proposés aux résidents (durée, heures, prix)
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreatePkg} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nouveau type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!packageTypesList || packageTypesList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun type de forfait configuré.</p>
              <p className="text-xs mt-1">Cliquez sur "Nouveau type" pour en créer un.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Libellé</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Heures</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Durée</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Prix</th>
                    <th className="text-center py-2 pr-4 font-medium text-muted-foreground">Actif</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {packageTypesList.map((pt: any) => (
                    <tr key={pt.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{pt.label}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{Math.round(pt.totalMinutes / 60)}h</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{pt.durationWeeks} sem.</td>
                      <td className="py-3 pr-4 text-right tabular-nums font-semibold">{pt.price} €</td>
                      <td className="py-3 pr-4 text-center">
                        {pt.isActive ? (
                          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-xs">Actif</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500 border-gray-300 bg-gray-50 text-xs">Inactif</Badge>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPkg(pt)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (confirm(`Supprimer le type "${pt.label}" ?`)) {
                                deletePkgTypeMutation.mutate({ id: pt.id });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog création / édition */}
      <Dialog open={pkgDialog.open} onOpenChange={(o) => setPkgDialog(prev => ({ ...prev, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pkgDialog.mode === 'create' ? 'Nouveau type de forfait' : 'Modifier le type de forfait'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Libellé <span className="text-red-500">*</span></Label>
              <Input placeholder="Ex : 15h / 8 semaines" value={pkgForm.label} onChange={e => setPkgForm(p => ({ ...p, label: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nombre d'heures <span className="text-red-500">*</span></Label>
                <Input type="number" min={1} step={0.5} placeholder="Ex : 15" value={pkgForm.hours} onChange={e => setPkgForm(p => ({ ...p, hours: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Durée (semaines) <span className="text-red-500">*</span></Label>
                <Input type="number" min={1} placeholder="Ex : 8" value={pkgForm.durationWeeks} onChange={e => setPkgForm(p => ({ ...p, durationWeeks: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Prix (€) <span className="text-red-500">*</span></Label>
                <Input type="number" min={0} placeholder="Ex : 175" value={pkgForm.price} onChange={e => setPkgForm(p => ({ ...p, price: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Ordre d'affichage</Label>
                <Input type="number" min={0} placeholder="0" value={pkgForm.sortOrder} onChange={e => setPkgForm(p => ({ ...p, sortOrder: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={pkgForm.isActive} onCheckedChange={v => setPkgForm(p => ({ ...p, isActive: v }))} id="pkg-active" />
              <Label htmlFor="pkg-active">Visible lors de la création d'un forfait</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPkgDialog(prev => ({ ...prev, open: false }))}>
              <X className="h-4 w-4 mr-1" /> Annuler
            </Button>
            <Button onClick={handleSavePkg} disabled={createPkgTypeMutation.isPending || updatePkgTypeMutation.isPending}>
              <Check className="h-4 w-4 mr-1" />
              {pkgDialog.mode === 'create' ? 'Créer' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Liens de paiement ── */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Liens de Paiement
              </CardTitle>
              <CardDescription className="mt-1">
                Ces liens apparaissent dans les e-mails de résumé de session quand le forfait est épuisé
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Liste des liens existants */}
          {paymentLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Aucun lien de paiement configuré. Les e-mails n'afficheront pas de liens de paiement.</p>
          ) : (
            <div className="space-y-2">
              {paymentLinks.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
                  {editingLinkIdx === idx ? (
                    <>
                      <Input
                        value={editLinkLabel}
                        onChange={e => setEditLinkLabel(e.target.value)}
                        placeholder="Libellé"
                        className="flex-1 h-8 text-sm"
                      />
                      <Input
                        value={editLinkUrl}
                        onChange={e => setEditLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className="flex-[2] h-8 text-sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 hover:text-green-800"
                        onClick={() => {
                          if (!editLinkLabel.trim() || !editLinkUrl.trim()) return;
                          const updated = paymentLinks.map((l, i) => i === idx ? { label: editLinkLabel.trim(), url: editLinkUrl.trim() } : l);
                          setPaymentLinks(updated);
                          updateAtelierSettingsMutation.mutate({ paymentLinks: JSON.stringify({ links: updated }) });
                          setEditingLinkIdx(null);
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingLinkIdx(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium truncate">{link.label}</span>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-[2] text-xs text-blue-600 hover:underline truncate">{link.url}</a>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => { setEditingLinkIdx(idx); setEditLinkLabel(link.label); setEditLinkUrl(link.url); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Supprimer le lien "${link.label}" ?`)) {
                            const updated = paymentLinks.filter((_, i) => i !== idx);
                            setPaymentLinks(updated);
                            updateAtelierSettingsMutation.mutate({ paymentLinks: JSON.stringify({ links: updated }) });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Formulaire d'ajout */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Ajouter un lien</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                value={newLinkLabel}
                onChange={e => setNewLinkLabel(e.target.value)}
                placeholder="Libellé (ex : Libre accès 15h / 8 sem.)"
                className="flex-1 min-w-[180px]"
              />
              <Input
                value={newLinkUrl}
                onChange={e => setNewLinkUrl(e.target.value)}
                placeholder="URL de paiement (https://...)"
                className="flex-[2] min-w-[220px]"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!newLinkLabel.trim() || !newLinkUrl.trim()) {
                    toast.error("Remplissez le libellé et l'URL");
                    return;
                  }
                  const updated = [...paymentLinks, { label: newLinkLabel.trim(), url: newLinkUrl.trim() }];
                  setPaymentLinks(updated);
                  updateAtelierSettingsMutation.mutate({ paymentLinks: JSON.stringify({ links: updated }) });
                  setNewLinkLabel("");
                  setNewLinkUrl("");
                }}
                disabled={updateAtelierSettingsMutation.isPending}
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Paramètres des E-mails Automatiques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Délai de rappel */}
          <div className="space-y-2">
            <Label className="font-semibold">Rappel avant expiration du forfait</Label>
            <p className="text-sm text-muted-foreground">Nombre de jours avant l'expiration pour envoyer le rappel automatique</p>
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                type="number"
                min={1}
                max={30}
                value={reminderDaysInput}
                onChange={(e) => setReminderDaysInput(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">jour(s)</span>
              <Button size="sm" onClick={handleSaveReminderDays} disabled={updateAtelierSettingsMutation.isPending}>
                Enregistrer
              </Button>
            </div>
          </div>

          {/* Guide des bonnes pratiques */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-semibold">Guide des bonnes pratiques à l'inscription</Label>
              <p className="text-sm text-muted-foreground">Envoyer automatiquement le guide PDF lors de la création d'un résident</p>
            </div>
            <Switch
              checked={guideEmailEnabled}
              onCheckedChange={handleToggleGuideEmail}
              disabled={updateAtelierSettingsMutation.isPending}
            />
          </div>

          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-semibold mb-1 text-sm">Planification</h4>
            <p className="text-sm text-muted-foreground">
              Les e-mails de rappel sont envoyés automatiquement <strong>tous les jours à 9h00</strong>.
              Testez l'envoi manuel depuis la page <strong>"Configuration E-mails"</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
