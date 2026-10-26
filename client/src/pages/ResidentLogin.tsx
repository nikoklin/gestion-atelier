import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, APP_LOGO } from "@/const";
import { ResidentLinkRequestForm } from "@/components/ResidentLinkRequestForm";

// Connexion à l'espace résident : pas de mot de passe, un lien personnel envoyé par e-mail.
export default function ResidentLogin() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-16 mx-auto mb-4" />}
          <CardTitle className="text-2xl">Mon espace</CardTitle>
          <CardDescription>
            Indique ton adresse e-mail : tu recevras un lien pour ouvrir ton espace. Ton appareil restera ensuite
            connecté.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResidentLinkRequestForm />
        </CardContent>
      </Card>
    </div>
  );
}
