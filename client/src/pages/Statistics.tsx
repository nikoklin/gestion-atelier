import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { usePackageLabel } from "@/hooks/usePackageLabel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Clock, Users, TrendingUp, Package, Euro, AlertTriangle, CalendarX } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#f97316'];

const PERIOD_LABELS: Record<string, string> = {
  month: "Ce mois",
  quarter: "Ce trimestre",
  year: "Cette année",
  all: "Toutes périodes",
};

export default function Statistics() {
  const [period, setPeriod] = useState<"month" | "quarter" | "year" | "all">("all");
  const [selectedResident, setSelectedResident] = useState<string>("all");
  const { getPackageLabel } = usePackageLabel();

  const { data: stats, isLoading: statsLoading } = trpc.stats.getAttendanceStats.useQuery();
  const { data: pkgStats, isLoading: pkgLoading } = trpc.stats.getPackageStats.useQuery({
    period,
    residentId: selectedResident !== "all" ? parseInt(selectedResident) : undefined,
  });

  const { data: residents } = trpc.residents.list.useQuery();

  const isLoading = statsLoading || pkgLoading;

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Statistiques</h1>
          <p className="text-muted-foreground">Analyse des heures de présence et des forfaits</p>
        </div>
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  // Préparer les données pour le graphique en camembert (présences)
  const residentData = stats?.byResident.map((r: any) => ({
    name: r.name,
    value: Math.round(r.totalMinutes / 60 * 10) / 10,
    sessions: r.sessions
  })) || [];

  return (
    <div className="container py-4 md:py-8">
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Statistiques</h1>
        <p className="text-muted-foreground text-sm">Analyse des heures de présence et des forfaits</p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Période :</span>
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="quarter">Ce trimestre</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
              <SelectItem value="all">Toutes périodes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Résident :</span>
          <Select value={selectedResident} onValueChange={setSelectedResident}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les résidents</SelectItem>
              {residents?.filter((r: any) => !r.isDeleted).map((r: any) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.firstName} {r.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Section Présences ──────────────────────────────────────────── */}
      {selectedResident === "all" && (
        <>
          <h2 className="text-xl font-semibold mb-4 text-muted-foreground uppercase tracking-wide text-xs">
            Présences
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalSessions || 0}</div>
                <p className="text-xs text-muted-foreground">Pointages enregistrés</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Heures</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalHours || 0}h</div>
                <p className="text-xs text-muted-foreground">Temps total passé</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Moyenne par Session</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.totalSessions && stats?.totalHours
                    ? Math.round((stats.totalHours / stats.totalSessions) * 10) / 10
                    : 0}h
                </div>
                <p className="text-xs text-muted-foreground">Durée moyenne</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Activité des 7 derniers jours</CardTitle>
                <CardDescription>Heures de présence par jour</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats?.last7Days || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis label={{ value: 'Heures', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="hours" fill="#3b82f6" name="Heures" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 10 Résidents</CardTitle>
                <CardDescription>Heures de présence par résident</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={residentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}h`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {residentData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── Section Forfaits ──────────────────────────────────────────── */}
      <h2 className="text-xl font-semibold mb-4 text-muted-foreground uppercase tracking-wide text-xs">
        Forfaits — {PERIOD_LABELS[period]}
      </h2>

      {/* Cards résumé forfaits */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forfaits vendus</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pkgStats?.totalPackages ?? 0}</div>
            <p className="text-xs text-muted-foreground">Total sur la période</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(pkgStats?.totalRevenue ?? 0).toLocaleString('fr-FR')} €</div>
            <p className="text-xs text-muted-foreground">Revenus estimés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirés prématurément</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pkgStats?.expiredEarlyCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Heures épuisées avant la date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirés par date</CardTitle>
            <CalendarX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{pkgStats?.expiredByDateCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {pkgStats?.totalLostHours ? `${pkgStats.totalLostHours}h perdues` : "Aucune heure perdue"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques forfaits */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-6">
        {/* Forfaits par catégorie */}
        <Card>
          <CardHeader>
            <CardTitle>Forfaits par catégorie</CardTitle>
            <CardDescription>Nombre de forfaits vendus par type</CardDescription>
          </CardHeader>
          <CardContent>
            {(pkgStats?.byCategory?.every((c: any) => c.count === 0)) ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Aucun forfait sur cette période</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={pkgStats?.byCategory || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any, name: string) =>
                      name === "count" ? [`${value} forfait(s)`, "Quantité"] : [`${value} €`, "Revenus"]
                    }
                  />
                  <Legend />
                  <Bar dataKey="count" fill="#3b82f6" name="Quantité" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Évolution mensuelle */}
        <Card>
          <CardHeader>
            <CardTitle>Évolution mensuelle</CardTitle>
            <CardDescription>Forfaits vendus et revenus par mois</CardDescription>
          </CardHeader>
          <CardContent>
            {(!pkgStats?.byMonth || pkgStats.byMonth.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Aucune donnée sur cette période</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={pkgStats.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}€`} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="count" stroke="#3b82f6" name="Forfaits" strokeWidth={2} dot />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" name="Revenus (€)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tableau revenus par catégorie */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Revenus par type de forfait</CardTitle>
          <CardDescription>Détail des ventes et revenus estimés par catégorie</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Type de forfait</th>
                  <th className="text-right p-2">Prix unitaire</th>
                  <th className="text-right p-2">Quantité</th>
                  <th className="text-right p-2">Revenus</th>
                </tr>
              </thead>
              <tbody>
                {pkgStats?.byCategory?.map((cat: any) => (
                  <tr key={cat.type} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{getPackageLabel(cat.type)}</td>
                    <td className="text-right p-2 text-muted-foreground">{cat.price} €</td>
                    <td className="text-right p-2">{cat.count}</td>
                    <td className="text-right p-2 font-semibold">{cat.revenue.toLocaleString('fr-FR')} €</td>
                  </tr>
                ))}
                <tr className="font-bold bg-muted/30">
                  <td className="p-2">Total</td>
                  <td className="p-2"></td>
                  <td className="text-right p-2">{pkgStats?.totalPackages ?? 0}</td>
                  <td className="text-right p-2">{(pkgStats?.totalRevenue ?? 0).toLocaleString('fr-FR')} €</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Forfaits expirés par date avec heures perdues — regroupés par type */}
      {(pkgStats?.expiredByDateByType?.length ?? 0) > 0 && (
        <Card className="mb-6 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarX className="h-5 w-5 text-red-500" />
              Forfaits expirés par date — heures perdues
            </CardTitle>
            <CardDescription>
              Types de forfaits dont la date de validité est le plus souvent atteinte avec des heures non utilisées
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Type de forfait</th>
                    <th className="text-right p-2">Nombre de fois expiré</th>
                    <th className="text-right p-2">Heures perdues (total)</th>
                  </tr>
                </thead>
                <tbody>
                  {pkgStats?.expiredByDateByType?.map((item: any) => (
                    <tr key={item.packageType} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <Badge variant="outline">{getPackageLabel(item.packageType)}</Badge>
                      </td>
                      <td className="text-right p-2 font-medium">{item.count}</td>
                      <td className="text-right p-2 font-semibold text-red-600">
                        {item.lostHours}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau détaillé par résident */}
      <Card>
        <CardHeader>
          <CardTitle>Détails par résident</CardTitle>
          <CardDescription>Statistiques forfaits par résident sur la période sélectionnée</CardDescription>
        </CardHeader>
        <CardContent>
          {(!pkgStats?.byResident || pkgStats.byResident.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Aucune donnée sur cette période</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Résident</th>
                    <th className="text-right p-2">Forfaits</th>
                    <th className="text-right p-2">Revenus</th>
                    <th className="text-right p-2">Exp. prématurés</th>
                    <th className="text-right p-2">Exp. par date</th>
                    <th className="text-right p-2">Heures perdues</th>
                  </tr>
                </thead>
                <tbody>
                  {pkgStats?.byResident?.map((r: any) => (
                    <tr key={r.residentId} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{r.residentName}</td>
                      <td className="text-right p-2">{r.totalPackages}</td>
                      <td className="text-right p-2 font-semibold">{r.totalRevenue.toLocaleString('fr-FR')} €</td>
                      <td className="text-right p-2">
                        {r.expiredEarlyCount > 0 ? (
                          <span className="text-amber-600 font-medium">{r.expiredEarlyCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="text-right p-2">
                        {r.expiredByDateCount > 0 ? (
                          <span className="text-red-600 font-medium">{r.expiredByDateCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="text-right p-2">
                        {r.lostHours > 0 ? (
                          <span className="text-red-600 font-medium">{r.lostHours}h</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tableau présences par résident (toujours visible) */}
      {selectedResident === "all" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Présences par résident</CardTitle>
            <CardDescription>Statistiques complètes de présence (toutes périodes)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Résident</th>
                    <th className="text-right p-2">Sessions</th>
                    <th className="text-right p-2">Total Heures</th>
                    <th className="text-right p-2">Moyenne/Session</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.byResident.map((resident: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{resident.name}</td>
                      <td className="text-right p-2">{resident.sessions}</td>
                      <td className="text-right p-2">
                        {Math.round(resident.totalMinutes / 60 * 10) / 10}h
                      </td>
                      <td className="text-right p-2">
                        {Math.round((resident.totalMinutes / resident.sessions) / 60 * 10) / 10}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
