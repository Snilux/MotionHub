import mongoose, { Schema, type Document, type Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  role: "medico" | "paciente";
  telefono?: string;
  fechaNacimiento?: Date;
  // Médico
  cedulaProfesional?: string;
  especialidad?: string;
  // Paciente
  medicoAsignado?: mongoose.Types.ObjectId;
  diagnostico?: string;
  // Recuperación de contraseña
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  // Control de sesión única (médicos)
  activeSessionToken?: string;
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
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["medico", "paciente"], required: true },
    telefono: { type: String },
    fechaNacimiento: { type: Date },
    // Campos médico
    cedulaProfesional: { type: String },
    especialidad: { type: String },
    // Campos paciente
    medicoAsignado: { type: Schema.Types.ObjectId, ref: "User" },
    diagnostico: { type: String },
    // Recuperación
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // Sesión única para médicos
    activeSessionToken: { type: String, default: null },
  },
  { timestamps: true }
);

// Hash password antes de guardar
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Comparar contraseña
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = (mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema)) as Model<IUser>;