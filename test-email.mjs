// Vérifie que la clé API Brevo est valide (sans envoyer d'e-mail).
const apiKey = process.env.BREVO_API_KEY;
const sender = process.env.EMAIL_USER;

console.log("BREVO_API_KEY:", apiKey ? "✓ configured" : "✗ missing");
console.log("EMAIL_USER:", sender ? "✓ configured" : "✗ missing");

if (apiKey) {
  console.log("\nTesting Brevo API key...");
  const res = await fetch("https://api.brevo.com/v3/account", {
    headers: { accept: "application/json", "api-key": apiKey },
  });
  if (res.ok) {
    const data = await res.json();
    console.log(`✓ Clé API valide — compte: ${data.email}`);
  } else {
    console.error(`✗ Clé API invalide (HTTP ${res.status}):`, await res.text());
  }
}
