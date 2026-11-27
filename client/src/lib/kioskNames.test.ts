import { describe, it, expect } from "vitest";
import { kioskDisplayNames } from "./kioskNames";

const names = (list: [number, string, string][]) =>
  Array.from(kioskDisplayNames(list.map(([id, firstName, lastName]) => ({ id, firstName, lastName }))).values());

describe("Noms de la tablette", () => {
  it("premier prénom + initiale du nom", () => {
    expect(names([[1, "Jean Patrick", "Martin"], [2, "Marie-Claire", "dupont"], [3, "Léa", "Essai"]]))
      .toEqual(["Jean M.", "Marie-Claire D.", "Léa E."]);
  });
  it("deux résidents qui donneraient le même nom : des lettres en plus, pour eux seulement", () => {
    expect(names([[1, "Jean", "Martin"], [2, "Jean Paul", "Moreau"], [3, "Anne", "Martin"]]))
      .toEqual(["Jean Ma.", "Jean Mo.", "Anne M."]);
  });
  it("homonymes complets : nom entier ; sans nom : prénom seul", () => {
    expect(names([[1, "Jean", "Roy"], [2, "Jean", "Roy"], [3, "Paul", ""]])).toEqual(["Jean Roy", "Jean Roy", "Paul"]);
  });
});
