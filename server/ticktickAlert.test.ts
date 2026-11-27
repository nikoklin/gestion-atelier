/**
 * Copie TickTick des alertes : le texte de la tâche reste lisible (liens en clair,
 * listes à puces). Test sans base ni envoi.
 */
import "dotenv/config";
import { describe, it, expect } from "vitest";
import { alertTaskText, htmlToText } from "./emailService";
import { renderShelfNoticeForAtelier } from "./shelfService";

describe("Alerte copiée vers TickTick", () => {
  it("garde le texte, les puces et l'adresse des liens", () => {
    const text = htmlToText(`<p>Le contrôle a repéré 2 points.</p><ul><li><strong>Jean M.</strong> — à vérifier <a href="https://x.example/residents/1">Ouvrir la fiche</a></li><li>Autre &amp; point</li></ul>`);
    expect(text).toBe("Le contrôle a repéré 2 points.\n\n• Jean M. — à vérifier Ouvrir la fiche : https://x.example/residents/1\n• Autre & point");
  });

  it("l'avis « étagère à vider » donne une tâche avec le lien vers la fiche", () => {
    const { subject, html } = renderShelfNoticeForAtelier({
      residentId: 42, firstName: "Camille", lastName: "Exemple", email: "", shelfNumber: "12",
      packageId: 1, finishedAt: new Date("2026-11-01T10:00:00Z"), noticeSent: false,
    } as any);
    const text = alertTaskText(html);
    expect(subject).toBe("Étagère n°12 à vider – Camille Exemple");
    expect(text).toContain("étagère n°12 est à vider");
    expect(text).toMatch(/Ouvrir la fiche du résident : https?:\/\/\S+\/residents\/42/);
    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).not.toContain("Atelier de céramique – Paris 12e"); // en-tête retiré
    expect(text.startsWith("Le forfait de Camille Exemple")).toBe(true);
  });
});
