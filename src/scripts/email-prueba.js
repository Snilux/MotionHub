// Envía un correo de prueba para comprobar la configuración SMTP del .env.
// Uso: npm run email:prueba -- tu@correo.com
// (dentro de Docker: docker compose exec app npm run email:prueba -- tu@correo.com)
import nodemailer from "nodemailer";

const env = (...nombres) => nombres.map((n) => process.env[n]?.trim()).find(Boolean);

const destino = process.argv[2];
if (!destino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
  console.error("Uso: npm run email:prueba -- tu@correo.com");
  process.exit(1);
}

const smtp = {
  host: env("SMTP_HOST", "EMAIL_HOST") ?? "smtp.gmail.com",
  port: Number(env("SMTP_PORT", "EMAIL_PORT")) || 587,
  user: env("SMTP_USER", "EMAIL_USER") ?? "",
  pass: (env("SMTP_PASS", "EMAIL_PASS") ?? "").replace(/\s+/g, ""),
  from: env("SMTP_FROM", "EMAIL_FROM"),
};

if (!smtp.user || !smtp.pass) {
  console.error("❌ Faltan EMAIL_USER y EMAIL_PASS (o SMTP_USER y SMTP_PASS) en .env");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: smtp.host,
  port: smtp.port,
  secure: smtp.port === 465,
  auth: { user: smtp.user, pass: smtp.pass },
});

try {
  console.log(`Conectando a ${smtp.host}:${smtp.port} como ${smtp.user}...`);
  await transporter.verify();
  const info = await transporter.sendMail({
    from: smtp.from ?? `"MotionHub" <${smtp.user}>`,
    to: destino,
    subject: "Correo de prueba – MotionHub",
    text: `Si lees esto, el envío de correos de MotionHub funciona.\n\nServidor: ${smtp.host}:${smtp.port}\nFecha: ${new Date().toLocaleString("es-MX")}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e7e5e4;border-radius:16px;">
      <h2 style="margin:0 0 12px;">Correo de prueba</h2>
      <p>Si lees esto, el envío de correos de <strong>MotionHub</strong> funciona.</p>
      <p style="color:#6b7280;font-size:14px;">Servidor: ${smtp.host}:${smtp.port}<br>Fecha: ${new Date().toLocaleString("es-MX")}</p>
    </div>`,
  });
  console.log(`✅ Enviado a ${destino} (id: ${info.messageId})`);
} catch (error) {
  console.error("❌ No se pudo enviar:", error.message);
  if (/Invalid login|535/.test(error.message)) {
    console.error("   Con Gmail usa una «contraseña de aplicación» (requiere verificación en dos pasos), no tu contraseña normal.");
  }
  process.exit(1);
}
