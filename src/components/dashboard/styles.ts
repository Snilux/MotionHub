// Clases compartidas por las páginas del dashboard (médico y paciente)
export const card = "bg-stone-50 border border-stone-200 rounded-2xl p-6";

export const btnPrimary =
  "text-base font-medium border border-black px-5 py-2.5 rounded-lg hover:bg-black hover:text-white transition-colors duration-200";

export const btnSecondary =
  "text-base font-medium border border-stone-300 px-4 py-2 rounded-lg hover:border-black hover:bg-black hover:text-white transition-colors duration-200";

export const input =
  "w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors";

// Etiqueta pequeña en mayúsculas (Diagnóstico, Teléfono, etc.)
export const label = "text-sm text-gray-500 font-medium tracking-widest uppercase";

// Píldora de estado: rellena (activo/confirmado) o con borde (pendiente/pausado)
export const chip = (filled: boolean) =>
  `text-sm px-3 py-1 rounded-full font-medium capitalize ${
    filled ? "bg-black text-white" : "border border-stone-400 text-gray-600"
  }`;

export const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
export const diasSemana = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

export const fechaLarga = (d: Date) => `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;

export const hora = (fecha: Date) =>
  fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

export const plural = (n: number, singular: string, varios: string) =>
  `${n} ${n === 1 ? singular : varios}`;

// "Hoy", "Mañana" o "Jue 23 oct"
export const diaRelativo = (fecha: Date, hoy = new Date()) => {
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);
  if (fecha.toDateString() === hoy.toDateString()) return "Hoy";
  if (fecha.toDateString() === manana.toDateString()) return "Mañana";
  return `${diasSemana[fecha.getDay()]} ${fecha.getDate()} ${meses[fecha.getMonth()]}`;
};
