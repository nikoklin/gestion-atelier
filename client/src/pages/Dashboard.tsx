import { useState } from "react";
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
import { Users, Package, Clock, Layers } from "lucide-react";
import { useLocation } from "wouter";
import { usePackageLabel } from "@/hooks/usePackageLabel";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: residents } = trpc.residents.getWithActivePackage.useQuery();
  const { data: recentAttendances } = trpc.attendances.listAll.useQuery();
  const { data: atelierSettings } = trpc.atelierSettings.get.useQuery();

  // Numéro d'étagère sélectionné (clic)
  const [selectedShelf, setSelectedShelf] = useState<number | null>(null);

  const activeResidents = residents?.filter((r) => r.isActive) || [];

  // Forfaits vraiment actifs (non expirés et non épuisés)
  const residentsWithActivePackage = residents?.filter((r) => {
    if (!r.activePackage) return false;
    const now = new Date();
    const endDate = new Date(r.activePackage.endDate);
    return now <= endDate && r.activePackage.usedHours < r.activePackage.totalHours;
  }) || [];

  const formatDateTime = (date: Date | string) =>
    new Date(date).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const { getPackageLabel } = usePackageLabel();

  const getResidentName = (residentId: number) => {
    const resident = residents?.find((r) => r.id === residentId);
    return resident ? `${resident.firstName} ${resident.lastName}` : "Inconnu";
  };

  // Calcul carte étagères
  const totalShelves = atelierSettings?.totalShelves ?? 0;
  const shelfResidentMap = new Map<number, string>();
  (residents || []).filter((r) => r.isActive && r.shelfNumber).forEach((r) => {
    const n = parseInt(r.shelfNumber as string, 10);
    if (!isNaN(n)) shelfResidentMap.set(n, r.firstName + ' ' + r.lastName);
  });
  const usedNumbers = new Set(shelfResidentMap.keys());
  const freeCount = totalShelves - usedNumbers.size;

  return (
    <div className="container py-4 md:py-8">
      <div className="mb-4 md:mb-8">
        <h1 className="text-3xl font-bold">Tableau de Bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de l'atelier</p>
      </div>

      {/* Cards résumé */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mb-4 md:mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Résidents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{residents?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeResidents.length} actif{activeResidents.length > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forfaits Actifs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{residentsWithActivePackage.length}</div>
            <div className="mt-2 space-y-1">
              {(() => {
                const packageCounts = residentsWithActivePackage.reduce((acc, r) => {
                  if (r.activePackage) {
                    const type = r.activePackage.packageType;
                    acc[type] = (acc[type] || 0) + 1;
                  }
                  return acc;
                }, {} as Record<string, number>);
                return Object.entries(packageCounts).map(([type, count]) => (
                  <p key={type} className="text-xs text-muted-foreground">
                    {getPackageLabel(type)}: {count}
                  </p>
                ));
              })()}
            </div>
          </CardContent>
        </Card>

        {totalShelves > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Étagères</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usedNumbers.size} / {totalShelves}</div>
              <span className={`text-xs font-medium ${freeCount === 0 ? 'text-red-600' : 'text-green-600'}`}>
                {freeCount} libre{freeCount > 1 ? 's' : ''}
              </span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pointages récents */}
      <Card className="mb-4 md:mb-8 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pointages Récents
          </CardTitle>
          <CardDescription>Les 10 derniers pointages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Résident</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead>Départ</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentAttendances?.slice(0, 10).map((attendance: any) => {
                const isOutOfPackage = (attendance as any).isOutOfPackage === true;
                return (
                  <TableRow
                    key={attendance.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${isOutOfPackage ? "bg-red-50 hover:bg-red-100" : ""}`}
                    onClick={() => setLocation(`/residents/${attendance.residentId}`)}
                  >
                    <TableCell className="font-medium">
                      {attendance.residentFirstName && attendance.residentLastName
                        ? `${attendance.residentFirstName} ${attendance.residentLastName}`
                        : getResidentName(attendance.residentId)}
                      {isOutOfPackage && (
                        <span className="ml-2 text-xs text-red-600 font-semibold">(Hors forfait)</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(attendance.checkInTime)}</TableCell>
                    <TableCell>
                      {attendance.checkOutTime ? formatDateTime(attendance.checkOutTime) : "-"}
                    </TableCell>
                    <TableCell>
                      {attendance.checkOutTime ? (
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20">
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
        </CardContent>
      </Card>

      {/* Grille des étagères */}
      {totalShelves > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Plan des Étagères
            </CardTitle>
            <CardDescription>
              Cliquez sur un numéro pour afficher le résident associé
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Infobulle clic */}
            {selectedShelf !== null && (
              <div className={`mb-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                usedNumbers.has(selectedShelf)
                  ? 'bg-gray-100 text-gray-800 border border-gray-300'
                  : 'bg-green-50 text-green-800 border border-green-300'
              }`}>
                <span className="font-bold">Étagère {selectedShelf} :</span>
                <span>
                  {usedNumbers.has(selectedShelf)
                    ? shelfResidentMap.get(selectedShelf)
                    : 'Libre'}
                </span>
                <button
                  onClick={() => setSelectedShelf(null)}
                  className="ml-2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Grille */}
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: totalShelves }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setSelectedShelf(selectedShelf === n ? null : n)}
                  className={`flex items-center justify-center rounded text-xs font-medium transition-all ${
                    selectedShelf === n
                      ? usedNumbers.has(n)
                        ? 'bg-gray-500 text-white ring-2 ring-gray-700'
                        : 'bg-green-500 text-white ring-2 ring-green-700'
                      : usedNumbers.has(n)
                        ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        : 'bg-green-100 text-green-700 ring-1 ring-green-400 hover:bg-green-200'
                  }`}
                  style={{ width: '32px', height: '32px' }}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Légende */}
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-green-100 ring-1 ring-green-400" />
                Libre
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-gray-200" />
                Occupée
              </span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
