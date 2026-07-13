import nodemailer from "nodemailer";

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASSWORD;

if (!user || !pass) {
  console.error("EMAIL credentials not configured");
  process.exit(1);
}

const config = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user, pass }
};

console.log("Sending test email...");
const transporter = nodemailer.createTransport(config);

try {
  const info = await transporter.sendMail({
    from: '"Atelier À Tour de Bras" <contact@atourdebras-atelier.com>',
    to: user,
    subject: "Test - Système d'e-mails",
    text: "Ceci est un e-mail de test pour vérifier que le système d'envoi fonctionne correctement."
  });
  console.log("✓ Email sent successfully!");
  console.log("Message ID:", info.messageId);
} catch (error) {
  console.error("✗ Failed to send email:", error.message);
  if (error.code) console.error("Error code:", error.code);
}
