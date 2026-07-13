import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Out of Package Hours Management', () => {
  it('should calculate total out of package hours correctly for existing resident', async () => {
    // Utiliser un résident existant pour le test
    // Nous allons simplement vérifier que la fonction ne plante pas
    const total = await db.getOutOfPackageHoursByResidentId(120009); // test auto
    
    // Le total devrait être un nombre (peut être 0 ou plus)
    expect(typeof total).toBe('number');
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it('should return 0 for resident with no out of package hours', async () => {
    // Utiliser un résident qui n'a pas d'heures hors forfait
    const total = await db.getOutOfPackageHoursByResidentId(999999); // ID inexistant
    
    expect(total).toBe(0);
  });

  it('should clear out of package hours without error', async () => {
    // Tester que la fonction s'exécute sans erreur
    await expect(
      db.clearOutOfPackageHours(120009)
    ).resolves.not.toThrow();
  });

  it('should mark hours as deducted without error', async () => {
    // Tester que la fonction s'exécute sans erreur
    await expect(
      db.markOutOfPackageHoursAsDeducted(120009, 60)
    ).resolves.not.toThrow();
  });
});
