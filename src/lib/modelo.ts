import mongoose, { type Model, type Schema } from "mongoose";

/**
 * Registra un modelo de Mongoose evitando el problema de la recarga en caliente.
 *
 * En desarrollo, Vite vuelve a ejecutar el archivo del modelo cuando cambia, pero
 * Mongoose conserva el modelo compilado la primera vez. Si se reutilizara, los
 * campos nuevos del esquema se descartarían en silencio al guardar (así se perdía
 * el video de los ejercicios). Por eso en desarrollo se vuelve a compilar.
 * En producción el archivo se ejecuta una sola vez y se usa el modelo existente.
 */
export function definirModelo<T>(nombre: string, schema: Schema<T>): Model<T> {
  if (import.meta.env.DEV && mongoose.models[nombre]) mongoose.deleteModel(nombre);
  return (mongoose.models[nombre] as Model<T> | undefined) ?? mongoose.model<T>(nombre, schema);
}
