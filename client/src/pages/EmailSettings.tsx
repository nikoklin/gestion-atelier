import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Mail, Send, AlertCircle, RotateCcw, Clock, Save, Edit, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EmailSettings() {
  const [isSending, setIsSending] = useState(false);
  const [sortCol, setSortCol] = useState<'sentAt' | 'residentName' | 'emailType'>('sentAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (col: 'sentAt' | 'residentName' | 'emailType') => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: 'sentAt' | 'residentName' | 'emailType' }) => {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  };
  const utils = trpc.useUtils();
  
  // États pour les templates
  const [reminderSubject, setReminderSubject] = useState("");
  const [reminderBody, setReminderBody] = useState("");
  const [expirationSubject, setExpirationSubject] = useState("");
  const [expirationBody, setExpirationBody] = useState("");
  const [sessionSubject, setSessionSubject] = useState("");
  const [sessionBody, setSessionBody] = useState("");

  const { data: expiringPackages } = trpc.packages.getExpiringPackages.useQuery();
  const { data: expiredPackages } = trpc.packages.getExpiredPackages.useQuery();
  const { data: emailHistory, isLoading: isLoadingHistory } = trpc.email.getEmailHistory.useQuery();
  const clearHistoryMutation = trpc.email.clearEmailHistory.useMutation({
    onSuccess: () => {
      toast.success("Historique effacé");
      utils.email.getEmailHistory.invalidate();
    },
    onError: () => toast.error("Erreur lors de l'effacement"),
  });
  const { data: templates } = trpc.emailTemplates.getAll.useQuery();

  const sendRemindersMutation = trpc.email.sendReminders.useMutation({
    onSuccess: () => {
      toast.success("Vérification des rappels effectuée avec succès");
      setIsSending(false);
      // Invalider les caches pour rafraîchir les données
      utils.packages.getExpiringPackages.invalidate();
      utils.packages.getExpiredPackages.invalidate();
    },
    onError: (error) => {
      toast.error("Erreur lors de l'envoi: " + error.message);
      setIsSending(false);
    },
  });

  const resetFlagsMutation = trpc.email.resetEmailFlags.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // Invalider les caches pour rafraîchir les données
      utils.packages.getExpiringPackages.invalidate();
      utils.packages.getExpiredPackages.invalidate();
      utils.residents.getWithActivePackage.invalidate(); // Rafraîchir les indicateurs sur la page Résidents
    },
    onError: (error) => {
      toast.error("Erreur lors de la réinitialisation: " + error.message);
    },
  });
  
  const saveTemplateMutation = trpc.emailTemplates.upsert.useMutation({
    onSuccess: () => {
      toast.success("Template enregistré avec succès");
      utils.emailTemplates.getAll.invalidate();
    },
    onError: (error: any) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });
  
  // Pré-remplir les champs quand les templates sont chargés
  useEffect(() => {
    if (templates) {
      const reminder = templates.find((t: any) => t.templateType === "reminder");
      const expiration = templates.find((t: any) => t.templateType === "expiration");
      const session = templates.find((t: any) => t.templateType === "session_summary");

      if (reminder) {
        setReminderSubject(reminder.subject);
        setReminderBody(reminder.body);
      }
      if (expiration) {
        setExpirationSubject(expiration.subject);
        setExpirationBody(expiration.body);
      }
      if (session) {
        setSessionSubject(session.subject);
        setSessionBody(session.body);
      }
    }
  }, [templates]);

  const handleSendReminders = () => {
    if (confirm("Voulez-vous déclencher manuellement l'envoi des e-mails de rappel ?")) {
      setIsSending(true);
      sendRemindersMutation.mutate();
    }
  };

  const handleResetFlags = () => {
    if (confirm("Voulez-vous réinitialiser les flags d'envoi d'e-mails ? Cela permettra de renvoyer les e-mails de rappel aux forfaits qui les ont déjà reçus.")) {
      resetFlagsMutation.mutate();
    }
  };
  
  const handleSaveReminder = () => {
    saveTemplateMutation.mutate({
      templateType: "reminder",
      subject: reminderSubject,
      body: reminderBody,
    });
  };

  const handleSaveExpiration = () => {
    saveTemplateMutation.mutate({
      templateType: "expiration",
      subject: expirationSubject,
      body: expirationBody,
    });
  };

  const handleSaveSession = () => {
    saveTemplateMutation.mutate({
      templateType: "session_summary",
      subject: sessionSubject,
      body: sessionBody,
    });
  };

  return (
    <div className="container py-4 md:py-8">
      <div className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Rappel</h1>
        <p className="text-muted-foreground">
          Gestion des notifications automatiques par e-mail
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Envoi Automatique
            </CardTitle>
            <CardDescription>
              Le système vérifie automatiquement chaque jour les forfaits nécessitant un rappel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <h3 className="font-semibold">Forfaits Expirant dans 7 Jours</h3>
                </div>
                <p className="text-3xl font-bold text-yellow-600">
                  {expiringPackages?.length || 0}
                </p>
                {expiringPackages && expiringPackages.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {expiringPackages.map((pkg: any) => (
                      <div key={pkg.id} className="text-sm">
                        • <Link href={`/residents/${pkg.residentId}/packages`} className="text-blue-600 hover:underline">
                          {pkg.residentFirstName} {pkg.residentLastName}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
                {(!expiringPackages || expiringPackages.length === 0) && (
                  <p className="text-sm text-muted-foreground mt-2">Aucun forfait</p>
                )}
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold">Forfaits Expirés</h3>
                </div>
                <p className="text-3xl font-bold text-red-600">
                  {expiredPackages?.length || 0}
                </p>
                {expiredPackages && expiredPackages.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {expiredPackages.map((pkg: any) => (
                      <div key={pkg.id} className="text-sm">
                        • <Link href={`/residents/${pkg.residentId}/packages`} className="text-blue-600 hover:underline">
                          {pkg.residentFirstName && pkg.residentLastName
                            ? `${pkg.residentFirstName} ${pkg.residentLastName}`
                            : `${pkg.resident?.firstName} ${pkg.resident?.lastName}`}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
                {(!expiredPackages || expiredPackages.length === 0) && (
                  <p className="text-sm text-muted-foreground mt-2">Aucun forfait</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSendReminders}
                disabled={isSending}
                size="lg"
                className="flex-1"
              >
                <Send className="mr-2 h-4 w-4" />
                {isSending ? "Envoi en cours..." : "Envoyer les Rappels Maintenant"}
              </Button>
              <Button
                onClick={handleResetFlags}
                disabled={resetFlagsMutation.isPending}
                size="lg"
                variant="destructive"
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {resetFlagsMutation.isPending ? "Réinitialisation..." : "Réinitialiser les Flags"}
              </Button>
            </div>
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Note importante</AlertTitle>
              <AlertDescription>
                Le bouton "Réinitialiser les Flags" permet de renvoyer les e-mails de rappel aux forfaits qui les ont déjà reçus. Utilisez-le uniquement si vous devez retester le système ou renvoyer les rappels.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Personnalisation des Messages
            </CardTitle>
            <CardDescription>
              Modifiez le contenu des e-mails envoyés automatiquement. Utilisez {'{firstName}'}, {'{lastName}'}, {'{duration}'}, {'{dashboardUrl}'} pour insérer des variables.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="reminder" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="reminder">Rappel</TabsTrigger>
                <TabsTrigger value="expiration">Expiration</TabsTrigger>
                <TabsTrigger value="session">Résumé Session</TabsTrigger>
              </TabsList>

              <TabsContent value="reminder" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="reminder-subject">Sujet de l'e-mail</Label>
                  <Input
                    id="reminder-subject"
                    value={reminderSubject}
                    onChange={(e) => setReminderSubject(e.target.value)}
                    placeholder="Ton forfait arrive à expiration"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="reminder-body">Corps du message</Label>
                  <Textarea
                    id="reminder-body"
                    value={reminderBody}
                    onChange={(e) => setReminderBody(e.target.value)}
                    placeholder="Bonjour {'{firstName}'},&#10;&#10;Ton forfait expire bientôt..."
                    className="mt-1 min-h-[200px] font-mono text-sm"
                  />
                </div>
                <Button onClick={handleSaveReminder} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer le template de rappel
                </Button>
              </TabsContent>

              <TabsContent value="expiration" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="expiration-subject">Sujet de l'e-mail</Label>
                  <Input
                    id="expiration-subject"
                    value={expirationSubject}
                    onChange={(e) => setExpirationSubject(e.target.value)}
                    placeholder="Ton forfait est terminé"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="expiration-body">Corps du message</Label>
                  <Textarea
                    id="expiration-body"
                    value={expirationBody}
                    onChange={(e) => setExpirationBody(e.target.value)}
                    placeholder="Bonjour {'{firstName}'},&#10;&#10;Ton forfait a expiré..."
                    className="mt-1 min-h-[200px] font-mono text-sm"
                  />
                </div>
                <Button onClick={handleSaveExpiration} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer le template d'expiration
                </Button>
              </TabsContent>

              <TabsContent value="session" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="session-subject">Sujet de l'e-mail</Label>
                  <Input
                    id="session-subject"
                    value={sessionSubject}
                    onChange={(e) => setSessionSubject(e.target.value)}
                    placeholder="Résumé de ta session"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="session-body">Corps du message</Label>
                  <Textarea
                    id="session-body"
                    value={sessionBody}
                    onChange={(e) => setSessionBody(e.target.value)}
                    placeholder="Bonjour {'{firstName}'},&#10;&#10;Ta session a duré {'{duration}'}..."
                    className="mt-1 min-h-[200px] font-mono text-sm"
                  />
                </div>
                <Button onClick={handleSaveSession} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer le template de résumé
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historique des E-mails
              </CardTitle>
              {emailHistory && emailHistory.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    if (confirm("Effacer tout l'historique des e-mails ?")) {
                      clearHistoryMutation.mutate();
                    }
                  }}
                  disabled={clearHistoryMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Effacer
                </Button>
              )}
            </div>
            <CardDescription>
              Les 100 derniers e-mails envoyés aux résidents
            </CardDescription>
          </CardHeader>
          <CardContent>

            {isLoadingHistory ? (
              <p className="text-center text-muted-foreground py-8">Chargement...</p>
            ) : emailHistory && emailHistory.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('sentAt')}>Date<SortIcon col="sentAt" /></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('residentName')}>Résident<SortIcon col="residentName" /></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort('emailType')}>Type<SortIcon col="emailType" /></TableHead>
                      <TableHead>Sujet</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...(emailHistory ?? [])]
                      .sort((a, b) => {
                        let cmp = 0;
                        if (sortCol === 'sentAt') cmp = new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime();
                        else if (sortCol === 'residentName') cmp = (a.residentName ?? '').localeCompare(b.residentName ?? '', 'fr');
                        else if (sortCol === 'emailType') cmp = a.emailType.localeCompare(b.emailType);
                        return sortDir === 'asc' ? cmp : -cmp;
                      })
                      .map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(log.sentAt).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>{log.residentName}</TableCell>
                        <TableCell>
                          <Badge variant={
                            log.emailType === 'session_summary' ? 'default'
                            : log.emailType === 'reminder' ? 'secondary'
                            : log.emailType === 'guide' ? 'outline'
                            : 'destructive'
                          }>
                            {log.emailType === 'session_summary' ? 'Résumé session'
                              : log.emailType === 'reminder' ? 'Rappel'
                              : log.emailType === 'guide' ? 'Guide de bienvenue'
                              : 'Expiration'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Envoyé
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              Échoué
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucun e-mail envoyé</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
