import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: import.meta.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(import.meta.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: import.meta.env.SMTP_USER || "",
    pass: import.meta.env.SMTP_PASS || "",
  },
});

export async function sendPasswordResetEmail(
  to: string,
  nombre: string,
  resetUrl: string
) {
  await transporter.sendMail({
    from: `"MotionHub" <${import.meta.env.SMTP_USER}>`,
    to,
    subject: "Recuperar contraseña – MotionHub",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #2563eb;">MotionHub – Recuperación de contraseña</h2>
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo:</p>
        <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
          Restablecer contraseña
        </a>
        <p style="color:#6b7280;font-size:14px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
      </div>
    `,
  });
}
