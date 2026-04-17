import type { APIRoute } from "astro";
import crypto from "crypto";
import connectDB from "../../../lib/db";
import { User } from "../../../models/User";
import { sendPasswordResetEmail } from "../../../lib/email";

export const POST: APIRoute = async ({ request }) => {
  try {
    await connectDB();

    const { email } = await request.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Respuesta genérica para evitar enumeración de emails
    const genericResponse = new Response(
      JSON.stringify({
        message:
          "Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

    if (!user) return genericResponse;

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hora
    await user.save();

    const baseUrl = import.meta.env.SITE_URL || "http://localhost:4321";
    const resetUrl = `${baseUrl}/nueva-contrasena?token=${token}`;

    await sendPasswordResetEmail(user.email, user.nombre, resetUrl);

    return genericResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
