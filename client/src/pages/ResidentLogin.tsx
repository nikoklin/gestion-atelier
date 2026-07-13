import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, APP_LOGO } from "@/const";
import { User } from "lucide-react";

export default function ResidentLogin() {
  const [, setLocation] = useLocation();
  
  const { data: residents, isLoading } = trpc.residents.listActive.useQuery();

  const handleResidentClick = (residentId: number) => {
    localStorage.setItem("residentId", residentId.toString());
    setLocation(`/resident/dashboard`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          {APP_LOGO && (
            <img src={APP_LOGO} alt={APP_TITLE} className="h-16 mx-auto mb-4" />
          )}
          <CardTitle className="text-2xl">Espace Résident</CardTitle>
          <CardDescription>
            Sélectionnez votre nom pour accéder à votre espace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          ) : residents && residents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {residents
                .sort((a, b) => a.firstName.localeCompare(b.firstName))
                .map((resident) => (
                  <button
                    key={resident.id}
                    onClick={() => handleResidentClick(resident.id)}
                    className="flex items-center gap-3 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all text-left"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{resident.firstName} {resident.lastName}</p>
                      {resident.email && (
                        <p className="text-sm text-muted-foreground">{resident.email}</p>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Aucun résident actif</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
