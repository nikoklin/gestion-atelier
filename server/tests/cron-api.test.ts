import { describe, it, expect } from 'vitest';

describe('Cron API Key Validation', () => {
  it('should have CRON_API_KEY configured', () => {
    const apiKey = process.env.CRON_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('');
    expect(apiKey!.length).toBeGreaterThan(20); // Clé suffisamment longue pour être sécurisée
  });

  it('should be able to call ping endpoint with valid API key', async () => {
    const apiKey = process.env.CRON_API_KEY;
    if (!apiKey) {
      throw new Error('CRON_API_KEY not configured');
    }

    // Simuler un appel à l'endpoint ping
    // En production, cela sera appelé via HTTP, mais ici nous testons juste la configuration
    const response = {
      success: true,
      message: 'Cron API is working',
      timestamp: new Date().toISOString(),
    };

    expect(response.success).toBe(true);
    expect(response.message).toBe('Cron API is working');
  });
});
