import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Archive, RotateCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ArchivedResidents() {
  const { data: archivedResidents, isLoading, refetch } = trpc.residents.listArchived.useQuery();
  const restoreMutation = trpc.residents.restore.useMutation({
    onSuccess: () => {
      toast.success("Résident restauré avec succès");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erreur lors de la restauration : ${error.message}`);
    },
  });

  const handleRestore = (id: number, name: string) => {
    // TODO: Remplacer par une boîte de dialogue personnalisée
    restoreMutation.mutate({ id });
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("fr-FR");
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-center text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 md:py-8">
      <div className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Archive className="h-8 w-8" />
          Résidents Archivés
        </h1>
        <p className="text-muted-foreground mt-2">
          Liste des résidents supprimés (archivés). Vous pouvez les restaurer à tout moment.
        </p>
      </div>

      {archivedResidents && archivedResidents.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Aucun résident archivé. Les résidents supprimés apparaîtront ici et pourront être restaurés.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Liste des Résidents Archivés</CardTitle>
            <CardDescription>
              {archivedResidents?.length} résident(s) archivé(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Date d'archivage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedResidents?.map((resident) => (
                  <TableRow key={resident.id}>
                    <TableCell className="font-medium">
                      {resident.firstName} {resident.lastName}
                    </TableCell>
                    <TableCell>{resident.email}</TableCell>
                    <TableCell>{resident.phone || "-"}</TableCell>
                    <TableCell>{formatDate(resident.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(resident.id, `${resident.firstName} ${resident.lastName}`)}
                        disabled={restoreMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restaurer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
