import { useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

export default function FixCheckout() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";

  const [checkoutTime, setCheckoutTime] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Valider le token et récupérer les infos du pointage
  const { data: tokenInfo, isLoading: tokenLoading, error: tokenError } = trpc.actionTokens.validateFixCheckout.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const fixMutation = trpc.actionTokens.applyFixCheckout.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setError("");
    },
    onError: (err) => {
      setError(err.message || "Une erreur est survenue");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutTime || !token) return;
    fixMutation.mutate({ token, checkoutTime });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <CardTitle>Lien invalide</CardTitle>
            <CardDescription>Ce lien de correction est invalide ou manquant.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (tokenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (tokenError || !tokenInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <CardTitle>Lien expiré ou déjà utilisé</CardTitle>
            <CardDescription>
              Ce lien de correction a expiré (valable 48h) ou a déjà été utilisé.
              Contactez l'atelier si vous souhaitez corriger votre heure de sortie.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-500">
              <strong>À Tour de Bras</strong><br />
              13 Rue Abel, 75012 Paris<br />
              <a href="mailto:contact@atourdebras-atelier.com" className="text-blue-600 hover:underline">
                contact@atourdebras-atelier.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Heure corrigée !</CardTitle>
            <CardDescription>
              Ton heure de sortie a bien été mise à jour. Merci !
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-500">
              <strong>À Tour de Bras</strong><br />
              13 Rue Abel, 75012 Paris
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Formater la date de check-in pour l'affichage
  const checkInDate = tokenInfo.checkInTime ? new Date(tokenInfo.checkInTime) : null;
  const checkInFormatted = checkInDate
    ? checkInDate.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  // Valeur par défaut pour l'input datetime-local (date du check-in, heure 22:00)
  const defaultCheckout = checkInDate
    ? `${checkInDate.getFullYear()}-${String(checkInDate.getMonth() + 1).padStart(2, "0")}-${String(checkInDate.getDate()).padStart(2, "0")}T22:00`
    : "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Clock className="w-6 h-6 text-orange-600" />
          </div>
          <CardTitle>Corriger mon heure de sortie</CardTitle>
          <CardDescription>
            Bonjour {tokenInfo.residentFirstName}, tu peux corriger l'heure de sortie automatique enregistrée pour ta session du {checkInFormatted}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <p><strong>Arrivée :</strong> {checkInFormatted}</p>
              <p><strong>Sortie automatique :</strong> 22h00 (à corriger)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkoutTime">Heure de sortie réelle</Label>
              <Input
                id="checkoutTime"
                type="datetime-local"
                value={checkoutTime || defaultCheckout}
                onChange={(e) => setCheckoutTime(e.target.value)}
                required
                className="w-full"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={fixMutation.isPending}
            >
              {fixMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Correction en cours…</>
              ) : (
                "Confirmer l'heure de sortie"
              )}
            </Button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            À Tour de Bras · 13 Rue Abel, 75012 Paris
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
