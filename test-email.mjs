import nodemailer from "nodemailer";

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASSWORD;

console.log("EMAIL_USER:", user ? "✓ configured" : "✗ missing");
console.log("EMAIL_PASSWORD:", pass ? "✓ configured" : "✗ missing");

if (user && pass) {
  const config = {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass }
  };
  
  console.log("\nTesting SMTP connection...");
  const transporter = nodemailer.createTransport(config);
  
  try {
    await transporter.verify();
    console.log("✓ SMTP connection successful");
  } catch (error) {
    console.error("✗ SMTP connection failed:", error.message);
  }
}
