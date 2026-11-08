// Reportes PDF con el formato de los Word de referencia (Primer_Reporte y Siguientes_Reportes).
//
// Se generan en dos pasos:
//  1. expo-print convierte a PDF un HTML con el contenido (portada, tablas, fotos, firmas).
//  2. pdf-lib estampa en CADA página el encabezado (logo, título, código y revisión) y el pie
//     (proyecto, área y "Página X de Y"), porque el generador del teléfono no sabe numerar páginas.
import fontkit from '@pdf-lib/fontkit';
import * as Print from 'expo-print';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { fotoParaPdf, guardarPdf } from './archivos';
import {
  finalizarInspeccion,
  guardarReporte,
  inspeccionAnterior,
  listarAlcance,
  listarDocumentos,
  listarPuntosPendientes,
  obtenerAjustes,
  obtenerInspeccion,
  obtenerProyecto,
  puntosDeInspeccion,
  type Documento,
  type PuntoDelReporte,
} from './db';
import { fechaDia } from './fechas';
import { CARLITO_NEGRITA, CARLITO_REGULAR, LOGO_PNG } from './recursosPdf';

// Colores de los reportes Word
const AZUL = '#000F3F';
const GRIS_CLARO = '#EDEDED';
const TEXTO_SUAVE = '#595959';
const ESTADO: Record<string, { fondo: string; texto: string }> = {
  Cerrado: { fondo: '#00B050', texto: '#FFFFFF' },
  Pendiente: { fondo: '#C00000', texto: '#FFFFFF' },
  Anulado: { fondo: '#FFC000', texto: AZUL },
};

// Hoja A4 en puntos y márgenes del Word (1133 twips ≈ 57 pt)
const ANCHO = 595;
const ALTO = 842;
const MARGEN = 57;

// Evita que textos con < > & rompan el HTML del PDF
const esc = (t: string | null | undefined) =>
  (t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

/** "N° 2", "N° 2 y N° 3", "N° 1, N° 2 y N° 5" */
function listaNumeros(numeros: number[]) {
  const n = numeros.map((x) => `N° ${x}`);
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}

function textoDocumentos(docs: Documento[], detalle: string | null) {
  const lista = docs.map((d) => `${d.codigo}${d.rev ? ` Rev. ${d.rev}` : ''}, ${d.titulo}`).join(' / ');
  if (!detalle) return lista;
  return lista ? `${lista} — ${detalle}` : detalle;
}

// En <thead> para que la fila de títulos se repita si la tabla continúa en otra página
const tablaCabecera = (columnas: string[], anchos: string[]) =>
  `<thead><tr>${columnas.map((c, i) => `<th style="width:${anchos[i]}">${esc(c)}</th>`).join('')}</tr></thead>`;

/** Genera el PDF, lo guarda en el teléfono, registra el reporte y devuelve su id. */
export async function generarReporte(inspeccionId: number): Promise<number> {
  const insp = await obtenerInspeccion(inspeccionId);
  if (!insp) throw new Error('No se encontró la inspección.');
  const proyecto = await obtenerProyecto(insp.proyecto_id);
  if (!proyecto) throw new Error('No se encontró el proyecto.');
  const puntos = await puntosDeInspeccion(inspeccionId);
  if (puntos.length === 0) throw new Error('La inspección no tiene puntos registrados.');

  const ajustes = await obtenerAjustes();
  const alcance = await listarAlcance(proyecto.id);
  const documentos = await listarDocumentos(proyecto.id);
  const quedanPendientes = (await listarPuntosPendientes(proyecto.id)).map((p) => p.numero);

  const esRI = insp.tipo === 'Re-Inspección';
  const codigo = esRI ? `${proyecto.codigo}-RI${insp.numero}` : proyecto.codigo;
  const titulo = esRI ? `Re-Inspección N° ${insp.numero}` : 'Reporte de Inspección ITO';
  const elaborado = [ajustes.inspector_nombre, ajustes.inspector_cargo].filter(Boolean).join(' — ') || '—';
  const proyectoTexto = `${proyecto.nombre} — Teck CDA`;

  const cerrados = puntos.filter((p) => p.estado === 'Cerrado').length;
  const pendientes = puntos.filter((p) => p.estado === 'Pendiente').length;
  const anulados = puntos.filter((p) => p.estado === 'Anulado').length;

  // ---------- Portada ----------
  let html = `
    <img class="logo" src="data:image/png;base64,${LOGO_PNG}">
    <p class="antetitulo">${esRI ? 'RE-INSPECCIÓN ITO' : 'INFORME DE INSPECCIÓN ITO'}</p>
    <h1>${esc(titulo)}</h1>
    <p class="subtitulo">${esc(esRI ? `Seguimiento de puntos pendientes del reporte ${proyecto.codigo}` : proyecto.nombre)}</p>
    <table class="datos">
      ${(
        [
          ['Tipo de documento', esRI ? 'Re-Inspección ITO' : 'Informe de Inspección ITO'],
          ['Proyecto', proyectoTexto],
          ['Código', codigo],
          ['Revisión', proyecto.revision],
          ['Área', proyecto.area],
          ['Elaborado por', elaborado],
          ['Fecha', fechaDia(insp.fecha)],
        ] as const
      )
        .map(([e, v]) => `<tr><td class="etq">${esc(e)}</td><td>${esc(v)}</td></tr>`)
        .join('')}
    </table>`;

  let seccion = 0;
  const titular = (t: string) => `<h2>${++seccion}. ${esc(t)}</h2>`;

  // ---------- Antecedentes ----------
  const antecedentes: [string, string][] = [];
  if (esRI) {
    const original = await inspeccionAnterior(proyecto.id, 'Inspección', 0);
    const previa = insp.numero > 1 ? await inspeccionAnterior(proyecto.id, 'Re-Inspección', insp.numero - 1) : null;
    antecedentes.push([
      'Reporte de inspección original',
      original ? `${original.codigo ?? proyecto.codigo} — ${fechaDia(original.fecha)}` : proyecto.codigo,
    ]);
    antecedentes.push([
      'Re-inspección anterior',
      previa
        ? `${previa.codigo ?? `${proyecto.codigo}-RI${previa.numero}`} — ${fechaDia(previa.fecha)}`
        : 'No aplica (primera re-inspección)',
    ]);
  }
  antecedentes.push(
    ['Fecha', fechaDia(insp.fecha)],
    ['Sector / área', insp.sector_area],
    ['Contratista', proyecto.contratista],
    ['N° contrato / OT', proyecto.contrato],
    ['Personal presente', insp.personal]
  );
  const tablaAntecedentes = `
    <table>${tablaCabecera(['Campo', 'Detalle'], ['35%', '65%'])}
      ${antecedentes.map(([c, d]) => `<tr><td>${esc(c)}</td><td>${esc(d) || '—'}</td></tr>`).join('')}
    </table>`;

  if (!esRI) {
    // 1. Alcance
    const incluido = alcance.filter((a) => a.tipo === 'Incluido').map((a) => a.texto);
    const excluido = alcance.filter((a) => a.tipo === 'Excluido').map((a) => a.texto);
    html += titular('Alcance');
    html += `<ul>
      <li><b>Incluido:</b> ${esc(incluido.join('; ')) || 'No especificado'}.</li>
      <li><b>Excluido:</b> ${esc(excluido.join('; ')) || 'No especificado'}.</li>
    </ul>`;

    // 2. Documentos de referencia
    html += titular('Documentos de referencia');
    html += documentos.length
      ? `<table>${tablaCabecera(['Código', 'Título', 'Rev.'], ['27%', '58%', '15%'])}
          ${documentos.map((d) => `<tr><td>${esc(d.codigo)}</td><td>${esc(d.titulo)}</td><td>${esc(d.rev)}</td></tr>`).join('')}
        </table>`
      : '<p>Sin documentos de referencia.</p>';

    // 3. Antecedentes
    html += titular('Antecedentes de la inspección') + tablaAntecedentes;
  } else {
    html += titular('Antecedentes') + tablaAntecedentes;
  }

  // ---------- Puntos ----------
  html += titular(esRI ? 'Puntos re-inspeccionados' : 'Puntos inspeccionados');
  html += esRI
    ? '<p class="nota">Estado: CERRADO (verde) — hallazgo corregido. PENDIENTE (rojo) — hallazgo sin corregir, pasa a la siguiente re-inspección. ANULADO (amarillo) — punto que dejó de aplicar.</p>'
    : '<p class="nota">Estado: CERRADO (verde) — conforme. PENDIENTE (rojo) — con hallazgo, indica documento de referencia. ANULADO (amarillo) — punto que no aplica o fue eliminado.</p>';

  let numeroFoto = 0;
  const filas: string[] = [];
  for (const p of puntos) filas.push(await filaPunto(p, esRI, () => ++numeroFoto));
  html += `<table class="puntos">
    ${tablaCabecera(['N°', esRI ? 'Punto pendiente' : 'Punto inspeccionado', 'Estado', 'Registro fotográfico'], ['7%', '45%', '14%', '34%'])}
    ${filas.join('')}
  </table>`;

  // ---------- Resumen (solo re-inspección) ----------
  if (esRI) {
    html += `<div class="bloque">${titular('Resumen')}`;
    html += `<table>${tablaCabecera(['Puntos re-inspeccionados', 'Cerrados', 'Pendientes', 'Anulados'], ['34%', '22%', '22%', '22%'])}
      <tr><td>${puntos.length}</td><td>${cerrados}</td><td>${pendientes}</td><td>${anulados}</td></tr></table></div>`;
  }

  // ---------- Próxima visita y firmas (se mantienen juntas en la misma página) ----------
  html += `<div class="bloque">${titular('Próxima visita')}`;
  if (quedanPendientes.length) {
    html += esRI
      ? `<p class="nota">Quedan puntos pendientes. Se debe realizar la Re-Inspección N° ${insp.numero + 1} para verificar su cierre:</p>`
      : '<p class="nota">Quedan puntos pendientes. Se debe realizar una nueva visita de inspección para verificar su cierre:</p>';
    html += `<table>${tablaCabecera(['Puntos pendientes', esRI ? 'Fecha Re-Inspección' : 'Fecha nueva visita', 'Responsable del cierre'], ['34%', '26%', '40%'])}
      <tr><td>${listaNumeros(quedanPendientes)}</td><td>${fechaDia(insp.proxima_fecha) || '—'}</td><td>${esc(insp.proxima_responsable) || '—'}</td></tr></table>`;
  } else {
    html += '<p class="nota">Todos los puntos inspeccionados quedaron cerrados. No se requiere nueva visita.</p>';
  }

  // ---------- Firmas ----------
  html += `<table class="firmas"><tr>
    <td><div class="linea"></div><b>${esc(ajustes.inspector_nombre) || 'ITO'}</b><br>
      <span class="suave">${esc([ajustes.inspector_cargo, 'Teck'].filter(Boolean).join(' — '))}</span></td>
    <td><div class="linea"></div><span class="suave">Supervisor Contratista</span></td>
  </tr></table></div>`;

  const documento = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`;

  // 1) Contenido
  const resultado = await Print.printToFileAsync({ html: documento, width: ANCHO, height: ALTO, base64: true });
  if (!resultado.base64) throw new Error('No se recibió el contenido del PDF.');

  // 2) Encabezado y pie en todas las páginas
  const final = await estamparEncabezadoYPie(resultado.base64, {
    titulo,
    codigoRev: `${codigo}  |  Rev. ${proyecto.revision}`,
    pie: `${proyectoTexto}  |  ${proyecto.area}`,
  });

  const archivo = await guardarPdf(final, `${codigo} ${fechaDia(insp.fecha)}`);
  await finalizarInspeccion(inspeccionId);
  return guardarReporte({
    proyecto_id: proyecto.id,
    inspeccion_id: inspeccionId,
    tipo: insp.tipo,
    codigo,
    nombre: titulo,
    archivo,
    total: puntos.length,
    cerrados,
    pendientes,
    anulados,
  });
}

/** Una fila de la tabla de puntos, con sus fotos numeradas. */
async function filaPunto(p: PuntoDelReporte, esRI: boolean, siguienteFoto: () => number) {
  const estado = p.estado ?? 'Pendiente';
  const c = ESTADO[estado];
  const anulado = estado === 'Anulado';
  let descripcion = `<b>${esc(p.punto_nombre)}</b>`;
  if (esRI) {
    descripcion += `<p><b>Hallazgo original:</b> ${p.hallazgo ? esc(p.hallazgo.observacion) || 'Sin observación' : 'Punto nuevo, sin hallazgo previo.'}</p>`;
    descripcion += `<p><b>${anulado ? 'Punto anulado' : 'Verificación'}:</b> ${esc(p.observacion) || '—'}</p>`;
  } else if (p.observacion) {
    descripcion += `<p>${anulado ? '<b>Punto anulado:</b> ' : ''}${esc(p.observacion)}</p>`;
  }
  if (estado === 'Pendiente' && (p.documentos.length || p.doc_detalle)) {
    descripcion += `<p><b>Documento de referencia: ${esc(textoDocumentos(p.documentos, p.doc_detalle))}</b></p>`;
  }

  let fotos = '';
  for (const f of p.fotos) {
    const n = siguienteFoto();
    const src = await fotoParaPdf(f.archivo);
    fotos += `<div class="foto"><img src="${src}"><div class="pie">Foto ${n}${f.pie ? ` — ${esc(f.pie)}` : ''}</div></div>`;
  }

  return `<tr>
    <td class="centro">${p.punto_numero}</td>
    <td>${descripcion}</td>
    <td class="estado" style="background:${c.fondo};color:${c.texto}">${estado.toUpperCase()}</td>
    <td class="fotos">${fotos || '<span class="suave">Sin fotos</span>'}</td>
  </tr>`;
}

/** Dibuja el encabezado y el pie del Word en cada página del PDF. */
async function estamparEncabezadoYPie(
  pdfBase64: string,
  textos: { titulo: string; codigoRev: string; pie: string }
): Promise<string> {
  const pdf = await PDFDocument.load(pdfBase64);
  let normal: PDFFont;
  let negrita: PDFFont;
  try {
    pdf.registerFontkit(fontkit);
    normal = await pdf.embedFont(CARLITO_REGULAR, { subset: true });
    negrita = await pdf.embedFont(CARLITO_NEGRITA, { subset: true });
  } catch {
    // Si la fuente no se puede incrustar, se usa Helvetica (incluida en todo lector de PDF)
    normal = await pdf.embedFont(StandardFonts.Helvetica);
    negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  }
  const logo = await pdf.embedPng(LOGO_PNG);
  const azul = rgb(0, 15 / 255, 63 / 255);
  const suave = rgb(89 / 255, 89 / 255, 89 / 255);
  const gris = rgb(191 / 255, 191 / 255, 191 / 255);
  const paginas = pdf.getPages();
  const derecha = (texto: string, fuente: PDFFont, tam: number) => ANCHO - MARGEN - fuente.widthOfTextAtSize(texto, tam);

  paginas.forEach((pagina, i) => {
    // Encabezado: logo a la izquierda, título y código a la derecha, línea azul debajo
    const altoLogo = 24;
    const anchoLogo = (logo.width / logo.height) * altoLogo;
    pagina.drawImage(logo, { x: MARGEN, y: ALTO - 28 - altoLogo, width: anchoLogo, height: altoLogo });
    pagina.drawText(textos.titulo, { x: derecha(textos.titulo, negrita, 9), y: ALTO - 38, size: 9, font: negrita, color: azul });
    pagina.drawText(textos.codigoRev, { x: derecha(textos.codigoRev, normal, 8), y: ALTO - 49, size: 8, font: normal, color: suave });
    pagina.drawLine({ start: { x: MARGEN, y: ALTO - 57 }, end: { x: ANCHO - MARGEN, y: ALTO - 57 }, thickness: 0.75, color: azul });

    // Pie: línea gris, proyecto y área a la izquierda, número de página a la derecha
    const numero = `Página ${i + 1} de ${paginas.length}`;
    let pie = textos.pie;
    const maximo = ANCHO - 2 * MARGEN - normal.widthOfTextAtSize(numero, 7.5) - 20;
    while (pie.length > 3 && normal.widthOfTextAtSize(pie, 7.5) > maximo) pie = `${pie.slice(0, -2)}…`;
    pagina.drawLine({ start: { x: MARGEN, y: 46 }, end: { x: ANCHO - MARGEN, y: 46 }, thickness: 0.5, color: gris });
    pagina.drawText(pie, { x: MARGEN, y: 34, size: 7.5, font: normal, color: suave });
    pagina.drawText(numero, { x: derecha(numero, normal, 7.5), y: 34, size: 7.5, font: normal, color: suave });
  });
  return pdf.saveAsBase64();
}

// Estilos del contenido. Los márgenes superior e inferior dejan espacio al encabezado y al pie.
const CSS = `
  @font-face { font-family: Carlito; font-weight: 400; src: url(data:font/ttf;base64,${CARLITO_REGULAR}); }
  @font-face { font-family: Carlito; font-weight: 700; src: url(data:font/ttf;base64,${CARLITO_NEGRITA}); }
  @page { size: A4; margin: 72pt ${MARGEN}pt 62pt ${MARGEN}pt; }
  body { font-family: Carlito, Calibri, sans-serif; color: #1B1B1B; font-size: 9.5pt; line-height: 1.25; margin: 0; }
  .logo { height: 46pt; margin: 4pt 0 18pt; }
  .antetitulo { color: ${TEXTO_SUAVE}; font-weight: 700; font-size: 11pt; margin: 0 0 4pt; letter-spacing: .3pt; }
  h1 { color: ${AZUL}; font-size: 21pt; margin: 0 0 4pt; }
  .subtitulo { color: ${TEXTO_SUAVE}; font-size: 12pt; margin: 0 0 16pt; }
  h2 { color: ${AZUL}; font-size: 13pt; margin: 18pt 0 6pt; page-break-after: avoid; }
  p { margin: 3pt 0; }
  .nota { text-align: justify; margin-bottom: 6pt; }
  ul { margin: 0; padding-left: 16pt; } li { margin: 2pt 0; }
  table { width: 100%; border-collapse: collapse; margin: 4pt 0 8pt; table-layout: fixed; }
  th, td { border: 0.5pt solid #000; padding: 3pt 5pt; vertical-align: top; text-align: left; word-wrap: break-word; }
  th { background: ${AZUL}; color: #FFFFFF; font-weight: 700; }
  tr { page-break-inside: avoid; }
  .bloque { page-break-inside: avoid; }
  .datos .etq { background: ${GRIS_CLARO}; font-weight: 700; width: 35%; }
  .centro { text-align: center; }
  .estado { text-align: center; font-weight: 700; vertical-align: middle; }
  .fotos { text-align: center; }
  .foto { margin: 2pt 0 5pt; }
  .foto img { width: 100%; height: auto; display: block; }
  .pie { color: ${TEXTO_SUAVE}; font-size: 8pt; text-align: center; margin-top: 2pt; }
  .suave { color: ${TEXTO_SUAVE}; font-size: 9pt; }
  .firmas { margin-top: 40pt; page-break-inside: avoid; }
  .firmas td { border: none; text-align: center; width: 50%; padding: 0 20pt; }
  .firmas .linea { border-top: 0.5pt solid #000; margin: 0 10pt 4pt; }
  .puntos td p { margin: 3pt 0 0; }
`;
