import { trpc } from "@/lib/trpc";

/**
 * Hook qui résout le nom lisible d'un type de forfait.
 * Gère les types statiques (15h_8w, etc.) et les types dynamiques (custom_{id}).
 */
export function usePackageLabel() {
  const { data: dynamicTypes } = trpc.packageTypes.getActive.useQuery();

  const getPackageLabel = (packageType: string | null | undefined): string => {
    if (!packageType) return "—";

    // Types statiques historiques
    switch (packageType) {
      case "15h_8w": return "15h / 8 semaines";
      case "30h_8w": return "30h / 8 semaines";
      case "30h_4w": return "30h / 4 semaines";
      case "180h_6m": return "180h / 6 mois";
    }

    // Types dynamiques : custom_{id}
    if (packageType.startsWith("custom_") && dynamicTypes) {
      const id = parseInt(packageType.replace("custom_", ""), 10);
      const found = dynamicTypes.find((t) => t.id === id);
      if (found) return found.label;
    }

    // Fallback : retourner le code brut
    return packageType;
  };

  return { getPackageLabel, dynamicTypes };
}
