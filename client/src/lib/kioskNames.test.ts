import { describe, it, expect } from "vitest";
import { kioskDisplayNames } from "./kioskNames";

const names = (list: [number, string, string][]) =>
  Array.from(kioskDisplayNames(list.map(([id, firstName, lastName]) => ({ id, firstName, lastName }))).values());

describe("Noms de la tablette", () => {
  it("premier prénom seul quand il n'y a pas de doublon", () => {
    expect(names([[1, "Jean Patrick", "Martin"], [2, "Marie-Claire", "dupont"], [3, "Léa", "Essai"]]))
      .toEqual(["Jean", "Marie-Claire", "Léa"]);
  });
  it("même prénom : initiale du nom pour eux seuls, plus de lettres si besoin", () => {
    expect(names([[1, "Jean", "Martin"], [2, "Jean Paul", "Dupont"], [3, "Anne", "Martin"]]))
      .toEqual(["Jean M.", "Jean D.", "Anne"]);
    expect(names([[1, "Jean", "Martin"], [2, "Jean", "Moreau"], [3, "Léa", "E"]]))
      .toEqual(["Jean Ma.", "Jean Mo.", "Léa"]);
    expect(names([[1, "Léa", "Durand"], [2, "lea", "Petit"]])).toEqual(["Léa D.", "lea P."]); // accents et majuscules ignorés
  });
  it("homonymes complets : nom entier ; sans nom : prénom seul", () => {
    expect(names([[1, "Jean", "Roy"], [2, "Jean", "Roy"], [3, "Paul", ""]])).toEqual(["Jean Roy", "Jean Roy", "Paul"]);
  });
});
