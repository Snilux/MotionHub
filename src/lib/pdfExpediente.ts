import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { fechaLarga, hora } from "../components/dashboard/styles";
import { CAMPOS_EXPEDIENTE } from "./expediente";

// PDF del expediente clínico con la misma estética del dashboard: barra negra
// con la marca, etiquetas pequeñas en mayúsculas, tarjetas en tono piedra.

const A4 = { ancho: 595.28, alto: 841.89 };
const M = 48; // margen
const W = A4.ancho - M * 2; // ancho útil
const PIE = 40; // espacio reservado para el pie de página

const c = {
  negro: rgb(0, 0, 0),
  texto: rgb(0.07, 0.09, 0.15), // gray-900
  gris: rgb(0.42, 0.45, 0.5), // gray-500
  grisClaro: rgb(0.61, 0.64, 0.69), // gray-400
  linea: rgb(0.84, 0.83, 0.82), // stone-300
  borde: rgb(0.91, 0.9, 0.89), // stone-200
  fondo: rgb(0.98, 0.98, 0.976), // stone-50
  blanco: rgb(1, 1, 1),
};

export interface DatosPdfExpediente {
  paciente: { nombre: string; apellido: string; email: string; telefono?: string; fechaNacimiento?: Date };
  exp: any; // expediente con `medico` y `evolucion.medico` poblados
  generadoPor: string; // "Dr. Nombre Apellido"
}

const nombreMedico = (m: any) => (m?.nombre ? `Dr. ${m.nombre} ${m.apellido ?? ""}`.trim() : "");

const edad = (nac: Date, hoy = new Date()) => {
  let e = hoy.getFullYear() - nac.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())) e--;
  return e;
};

/** Nombre de archivo seguro: expediente-maria-lopez-2026-11-19.pdf */
export function nombreArchivoExpediente(p: { nombre: string; apellido: string }, fecha = new Date()) {
  const slug = `${p.nombre} ${p.apellido}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const dia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
  return `expediente-${slug || "paciente"}-${dia}.pdf`;
}

export async function generarPdfExpediente({ paciente, exp, generadoPor }: DatosPdfExpediente): Promise<Uint8Array> {
  const ahora = new Date();
  const nombreCompleto = `${paciente.nombre} ${paciente.apellido}`;

  const doc = await PDFDocument.create();
  doc.setTitle(`Expediente clínico – ${nombreCompleto}`);
  doc.setAuthor(generadoPor);
  doc.setCreator("MotionHub");
  doc.setProducer("MotionHub");
  doc.setCreationDate(ahora);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Las fuentes estándar del PDF solo cubren WinAnsi (español incluido);
  // cualquier otro carácter (emoji, etc.) se sustituye para no romper el documento.
  const soportados = new Set(regular.getCharacterSet());
  const limpiar = (s: unknown) =>
    [...String(s ?? "").normalize("NFC").replace(/\t/g, "  ").replace(/\r/g, "")]
      .map((ch) => (ch === "\n" || soportados.has(ch.codePointAt(0)!) ? ch : "?"))
      .join("");

  /** Parte el texto en líneas que caben en `ancho` (respeta saltos de línea y corta palabras muy largas). */
  const lineas = (s: unknown, font: PDFFont, size: number, ancho: number) => {
    const out: string[] = [];
    for (const parrafo of limpiar(s).split("\n")) {
      let linea = "";
      for (const palabra of parrafo.split(/ +/)) {
        const candidata = linea ? `${linea} ${palabra}` : palabra;
        if (font.widthOfTextAtSize(candidata, size) <= ancho) {
          linea = candidata;
          continue;
        }
        if (linea) out.push(linea);
        let resto = palabra;
        while (font.widthOfTextAtSize(resto, size) > ancho) {
          let i = resto.length - 1;
          while (i > 1 && font.widthOfTextAtSize(resto.slice(0, i), size) > ancho) i--;
          out.push(resto.slice(0, i));
          resto = resto.slice(i);
        }
        linea = resto;
      }
      out.push(linea);
    }
    return out;
  };

  // ── Páginas ───────────────────────────────────────────────────────────────
  let page: PDFPage = doc.addPage([A4.ancho, A4.alto]);
  let y = A4.alto;

  const texto = (s: string, x: number, yy: number, font: PDFFont = regular, size = 11, color = c.texto) =>
    page.drawText(s, { x, y: yy, font, size, color });

  const nuevaPagina = () => {
    page = doc.addPage([A4.ancho, A4.alto]);
    y = A4.alto - M;
    // Encabezado corto en las páginas siguientes
    texto("MotionHub", M, y - 10, bold, 11, c.negro);
    const t = limpiar(`Expediente clínico · ${nombreCompleto}`);
    texto(t, M + W - regular.widthOfTextAtSize(t, 9), y - 10, regular, 9, c.gris);
    y -= 20;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.75, color: c.linea });
    y -= 20;
  };

  /** Garantiza espacio vertical; si no cabe, salta de página. */
  const asegurar = (alto: number) => {
    if (y - alto < M + PIE) nuevaPagina();
  };

  const etiqueta = (s: string, x: number, yy: number) => texto(limpiar(s.toUpperCase()), x, yy, bold, 8, c.gris);

  const seccion = (titulo: string) => {
    asegurar(60);
    y -= 26;
    texto(limpiar(titulo.toUpperCase()), M, y, regular, 9, c.gris);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.75, color: c.linea });
    y -= 18;
  };

  /** Rejilla de etiqueta/valor en `cols` columnas, como los <dl> del dashboard. */
  const rejilla = (items: { label: string; value?: string }[], cols: number, size = 11) => {
    const gap = 24;
    const colW = (W - gap * (cols - 1)) / cols;
    const lh = size * 1.4;
    for (let i = 0; i < items.length; i += cols) {
      const fila = items.slice(i, i + cols).map((it) => ({
        ...it,
        lineas: it.value ? lineas(it.value, regular, size, colW) : null,
      }));
      const altoFila = 14 + Math.max(...fila.map((f) => (f.lineas?.length ?? 1) * lh));
      // Valores muy largos se reparten entre páginas
      if (altoFila > A4.alto - M * 2 - PIE - 60) {
        for (const f of fila) {
          asegurar(14 + lh);
          etiqueta(f.label, M, y);
          y -= 14;
          for (const l of f.lineas ?? ["Sin registrar"]) {
            asegurar(lh);
            texto(l, M, y - size * 0.8, regular, size, f.lineas ? c.texto : c.grisClaro);
            y -= lh;
          }
          y -= 14;
        }
        continue;
      }
      asegurar(altoFila);
      fila.forEach((f, j) => {
        const x = M + j * (colW + gap);
        etiqueta(f.label, x, y);
        let yy = y - 14;
        for (const l of f.lineas ?? ["Sin registrar"]) {
          texto(l, x, yy - size * 0.8, regular, size, f.lineas ? c.texto : c.grisClaro);
          yy -= lh;
        }
      });
      y -= altoFila + 20;
    }
  };

  // ── Portada: barra negra con la marca ────────────────────────────────────
  page.drawRectangle({ x: 0, y: A4.alto - 64, width: A4.ancho, height: 64, color: c.negro });
  texto("MotionHub", M, A4.alto - 40, bold, 18, c.blanco);
  const tituloDoc = "EXPEDIENTE CLÍNICO";
  texto(tituloDoc, M + W - regular.widthOfTextAtSize(tituloDoc, 9), A4.alto - 37, regular, 9, c.blanco);
  y = A4.alto - 64 - 28;

  // Tarjeta del paciente (avatar con inicial + nombre + correo)
  const altoTarjeta = 72;
  page.drawRectangle({
    x: M, y: y - altoTarjeta, width: W, height: altoTarjeta,
    color: c.fondo, borderColor: c.borde, borderWidth: 0.75,
  });
  const cx = M + 20 + 18;
  const cy = y - altoTarjeta / 2;
  page.drawCircle({ x: cx, y: cy, size: 18, color: c.negro });
  const inicial = limpiar(paciente.nombre.charAt(0).toUpperCase()) || "?";
  texto(inicial, cx - bold.widthOfTextAtSize(inicial, 16) / 2, cy - 5.5, bold, 16, c.blanco);
  const xNombre = cx + 18 + 14;
  const anchoNombre = M + W - 20 - xNombre;
  texto(lineas(nombreCompleto, bold, 18, anchoNombre)[0], xNombre, cy + 3, bold, 18, c.texto);
  texto(lineas(paciente.email, regular, 11, anchoNombre)[0], xNombre, cy - 14, regular, 11, c.gris);
  y -= altoTarjeta + 22;

  const nac = paciente.fechaNacimiento ? new Date(paciente.fechaNacimiento) : null;
  rejilla(
    [
      { label: "Fecha de nacimiento", value: nac ? `${fechaLarga(nac)} (${edad(nac, ahora)} años)` : undefined },
      { label: "Teléfono", value: paciente.telefono },
      { label: "Fisioterapeuta que abrió el expediente", value: nombreMedico(exp.medico) || undefined },
      { label: "Última actualización", value: fechaLarga(new Date(exp.updatedAt)) },
    ],
    2,
  );

  // ── Datos clínicos ────────────────────────────────────────────────────────
  seccion("Datos clínicos");
  rejilla(
    (["diagnostico", "motivoConsulta", "antecedentes", "alergias", "medicamentos"] as const).map((k) => ({
      label: CAMPOS_EXPEDIENTE[k],
      value: exp[k] ? String(exp[k]) : undefined,
    })),
    1,
  );

  // ── Evaluación física: números grandes, como las medidas del dashboard ────
  seccion("Evaluación física");
  const medidas = [
    { label: "Altura", value: exp.altura, unidad: "cm" },
    { label: "Peso", value: exp.peso, unidad: "kg" },
    { label: "Presión arterial", value: exp.presionArterial, unidad: "mmHg" },
  ];
  asegurar(50);
  const colM = W / medidas.length;
  medidas.forEach((m, i) => {
    const x = M + i * colM;
    etiqueta(m.label, x, y);
    if (m.value == null || m.value === "") {
      texto("Sin registrar", x, y - 26, regular, 11, c.grisClaro);
    } else {
      const v = lineas(String(m.value), bold, 22, colM - 50)[0];
      texto(v, x, y - 32, bold, 22, c.texto);
      texto(m.unidad, x + bold.widthOfTextAtSize(v, 22) + 4, y - 32, regular, 10, c.gris);
    }
  });
  y -= 50;

  // ── Notas de evolución (más recientes primero, como en el dashboard) ──────
  const notas = [...(exp.evolucion ?? [])].reverse();
  seccion(`Notas de evolución · ${notas.length}`);
  if (notas.length === 0) {
    asegurar(16);
    texto("Sin notas de evolución.", M, y - 9, regular, 11, c.gris);
    y -= 16;
  }
  const xNota = M + 18;
  const anchoNota = W - 18;
  notas.forEach((n: any, i: number) => {
    const fecha = new Date(n.fecha);
    const cabecera = `${fechaLarga(fecha)} · ${hora(fecha)}`;
    const autor = nombreMedico(n.medico);
    const ls = lineas(n.nota, regular, 11, anchoNota);
    asegurar(18 + Math.min(ls.length, 3) * 15.4); // la cabecera no queda sola al final de la página

    // Punto de la línea de tiempo: relleno en la más reciente
    page.drawCircle({
      x: M + 5, y: y - 5, size: 4.5,
      color: i === 0 ? c.negro : c.fondo, borderColor: c.negro, borderWidth: 1.5,
    });
    texto(cabecera, xNota, y - 9, bold, 10.5, c.texto);
    if (autor) texto(limpiar(`  ${autor}`), xNota + bold.widthOfTextAtSize(cabecera, 10.5), y - 9, regular, 10, c.gris);
    y -= 18;
    for (const l of ls) {
      asegurar(15.4);
      texto(l, xNota, y - 9, regular, 11, c.texto);
      y -= 15.4;
    }
    y -= 12;
  });

  // ── Pie en todas las páginas ──────────────────────────────────────────────
  const paginas = doc.getPages();
  const pie = limpiar(`Documento confidencial con datos de salud · Generado por ${generadoPor} el ${fechaLarga(ahora)}, ${hora(ahora)}`);
  paginas.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M - 4 }, end: { x: M + W, y: M - 4 }, thickness: 0.5, color: c.borde });
    const num = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(lineas(pie, regular, 8, W - 90)[0], { x: M, y: M - 18, font: regular, size: 8, color: c.gris });
    p.drawText(num, { x: M + W - regular.widthOfTextAtSize(num, 8), y: M - 18, font: regular, size: 8, color: c.gris });
  });

  return doc.save();
}
