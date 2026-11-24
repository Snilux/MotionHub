import mongoose, { Schema, type Document } from "mongoose";
import { definirModelo } from "../lib/modelo";
import bcrypt from "bcryptjs";
import { ESTADOS_VERIFICACION, type EstadoVerificacion } from "../lib/verificacion";

export interface IUser extends Document {
  nombre: string;
  apellido: string;
  email: string;
  password?: string;
  role: "medico" | "paciente" | "admin";
  telefono?: string;
  fechaNacimiento?: Date;
  // Inicio de sesión con Google
  googleId?: string;
  // Médico
  cedulaProfesional?: string;
  especialidad?: string;
  // Verificación de la cédula por un administrador
  estadoVerificacion?: EstadoVerificacion;
  motivoVerificacion?: string; // por qué se rechazó o revocó
  verificadoPor?: mongoose.Types.ObjectId;
  verificadoEn?: Date;
  // Paciente
  medicoAsignado?: mongoose.Types.ObjectId | null;
  diagnostico?: string;
  // Recuperación de contraseña (se guarda la huella SHA-256 del token, no el token)
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  // Cambio de correo pendiente de confirmar
  pendingEmail?: string;
  pendingEmailToken?: string; // huella SHA-256
  pendingEmailExpires?: Date;
  // Control de sesión única (médicos)
  activeSessionToken?: string | null;
  activeSessionExpires?: Date | null;
  // Los JWT emitidos antes de esta fecha ya no valen (al restablecer la contraseña)
  sesionesDesde?: Date | null;
  // Foto de perfil: ruta relativa dentro del volumen de subidas (src/lib/storage.ts)
  fotoPerfil?: string;
  // Recordatorios de sesiones (pacientes)
  recordatoriosCorreo?: boolean; // recibir el recordatorio por correo (por defecto sí)
  recordatorioEnviado?: string; // último día (AAAA-MM-DD) en que se le envió: evita duplicados
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Opcional para cuentas creadas con Google (pueden definirla después en su perfil)
    password: {
      type: String,
      minlength: 8,
      required: function (this: IUser) {
        return !this.googleId;
      },
    },
    role: { type: String, enum: ["medico", "paciente", "admin"], required: true },
    telefono: { type: String },
    fechaNacimiento: { type: Date },
    googleId: { type: String, index: { unique: true, sparse: true } },
    // Campos médico
    cedulaProfesional: { type: String },
    especialidad: { type: String },
    estadoVerificacion: { type: String, enum: ESTADOS_VERIFICACION },
    motivoVerificacion: { type: String, maxlength: 500 },
    verificadoPor: { type: Schema.Types.ObjectId, ref: "User" },
    verificadoEn: { type: Date },
    // Campos paciente
    medicoAsignado: { type: Schema.Types.ObjectId, ref: "User" },
    diagnostico: { type: String },
    // Recuperación
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // Cambio de correo
    pendingEmail: { type: String, lowercase: true, trim: true },
    pendingEmailToken: { type: String },
    pendingEmailExpires: { type: Date },
    // Sesión única para médicos
    activeSessionToken: { type: String, default: null },
    activeSessionExpires: { type: Date, default: null },
    sesionesDesde: { type: Date, default: null },
    fotoPerfil: { type: String },
    recordatoriosCorreo: { type: Boolean, default: true },
    recordatorioEnviado: { type: String },
  },
  { timestamps: true }
);

// Hash password antes de guardar
UserSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Comparar contraseña
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = definirModelo<IUser>("User", UserSchema);
