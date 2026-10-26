import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, APP_LOGO } from "@/const";
import { ResidentLinkRequestForm } from "@/components/ResidentLinkRequestForm";

// Ouverture de l'espace depuis le lien personnel reçu par e-mail (/resident/acces?t=…).
export default function ResidentAccess() {
  const [, setLocation] = useLocation();
  // Jeton lu une seule fois, puis retiré de l'adresse (pas de lien personnel dans l'historique).
  const [token] = useState(() => new URLSearchParams(window.location.search).get("t"));
  const started = useRef(false);
  const redeem = trpc.residentAuth.redeemLink.useMutation({
    onSuccess: () => {
      // L'identifiant éventuellement mémorisé (tablette, anciens liens) ne sert plus : la session suffit.
      try { localStorage.removeItem("residentId"); } catch { /* navigation privée */ }
      setLocation("/resident/dashboard");
    },
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    window.history.replaceState({}, "", "/resident/acces");
    if (token) redeem.mutate({ token });
  }, []);

  if (token && !redeem.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Ouverture de ton espace…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-16 mx-auto mb-4" />}
          <CardTitle className="text-2xl">Lien expiré</CardTitle>
          <CardDescription>
            Ce lien n'est plus valable (les liens durent 7 jours). Indique ton adresse e-mail pour en recevoir un nouveau.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResidentLinkRequestForm />
        </CardContent>
      </Card>
    </div>
  );
}
