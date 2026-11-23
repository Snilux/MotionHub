/**
 * Crea una cuenta de administrador (no hay registro público para este rol).
 * Ejecutar con: npm run admin:crear -- correo@dominio.com "Nombre" "Apellido"
 *
 * Genera una contraseña temporal y la muestra UNA vez: cámbiala desde
 * "Mi perfil" al entrar por primera vez.
 */

import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://admin:admin123@localhost:27017/motionhub?authSource=admin";

const [email, nombre, apellido] = process.argv.slice(2);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!email || !EMAIL_RE.test(email) || !nombre?.trim() || !apellido?.trim()) {
  console.error('Uso: npm run admin:crear -- correo@dominio.com "Nombre" "Apellido"');
  process.exit(1);
}

// Cumple la regla de contraseñas de la app (8+ caracteres, mayúscula, minúscula y número)
const passwordTemporal = () => `${crypto.randomBytes(9).toString("base64url")}Aa1`;

// Esquema mínimo (para no depender de TS en el script)
const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      nombre: String,
      apellido: String,
      email: { type: String, unique: true, lowercase: true, trim: true },
      password: String,
      role: String,
    },
    { timestamps: true },
  ),
);

async function main() {
  await mongoose.connect(MONGODB_URI);
  const correo = email.trim().toLowerCase();

  const existente = await User.findOne({ email: correo }).lean();
  if (existente) {
    // No se promueve una cuenta existente: un médico o paciente no debe volverse administrador sin querer
    console.error(`❌ Ya existe una cuenta con ${correo} (rol: ${existente.role}). Usa otro correo.`);
    process.exitCode = 1;
    return;
  }

  const password = passwordTemporal();
  await User.create({
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    email: correo,
    password: await bcrypt.hash(password, 12),
    role: "admin",
  });

  console.log("\n✅ Administrador creado");
  console.log(`   📧 ${correo}`);
  console.log(`   🔑 ${password}`);
  console.log("   Esta contraseña no se volverá a mostrar: cámbiala desde «Mi perfil» al entrar.\n");
}

main()
  .catch((err) => {
    console.error("❌ Error al crear el administrador:", err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
