// Envoie un vrai e-mail de test via l'API Brevo, à l'adresse EMAIL_USER (ou TO_EMAIL si fourni).
const apiKey = process.env.BREVO_API_KEY;
const sender = process.env.EMAIL_USER;
const to = process.env.TO_EMAIL || sender;

if (!apiKey || !sender) {
  console.error("BREVO_API_KEY ou EMAIL_USER manquant");
  process.exit(1);
}

console.log(`Sending test email to ${to}...`);
const res = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": apiKey,
  },
  body: JSON.stringify({
    sender: { name: "Atelier À Tour de Bras", email: sender },
    to: [{ email: to }],
    subject: "Test - Système d'e-mails (Brevo)",
    htmlContent:
      "<p>Ceci est un e-mail de test pour vérifier que le système d'envoi (via l'API Brevo) fonctionne correctement.</p>",
  }),
});

if (res.ok) {
  const data = await res.json();
  console.log("✓ Email sent successfully! messageId:", data.messageId);
} else {
  console.error(`✗ Failed to send email (HTTP ${res.status}):`, await res.text());
  process.exit(1);
}
