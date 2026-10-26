import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";

// Demande du lien de connexion à l'espace résident. Le message de confirmation
// est le même que l'adresse soit connue ou non (voir residentAuth.requestLoginLink).
export function ResidentLinkRequestForm() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const request = trpc.residentAuth.requestLoginLink.useMutation({
    onSuccess: () => setSentTo(email.trim()),
  });

  if (sentTo) {
    return (
      <div className="text-center space-y-3">
        <Mail className="h-10 w-10 mx-auto text-primary" />
        <p className="font-medium">Regarde ta boîte e-mail</p>
        <p className="text-sm text-muted-foreground">
          Si l'adresse <strong>{sentTo}</strong> est enregistrée à l'atelier, tu vas recevoir un lien pour ouvrir
          ton espace. Pense à vérifier les courriers indésirables.
        </p>
        <Button variant="ghost" size="sm" onClick={() => { setSentTo(null); request.reset(); }}>
          Utiliser une autre adresse
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) request.mutate({ email: email.trim() });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="resident-email">Ton adresse e-mail</Label>
        <Input
          id="resident-email"
          type="email"
          autoComplete="email"
          placeholder="ton.adresse@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {request.error && <p className="text-sm text-red-600">Adresse e-mail invalide.</p>}
      <Button type="submit" className="w-full" disabled={request.isPending}>
        {request.isPending ? "Envoi…" : "Recevoir mon lien"}
      </Button>
    </form>
  );
}
