// Generación del reporte PDF de una inspección.
import * as Print from 'expo-print';
import { fotoParaPdf, guardarPdf } from './archivos';
import { finalizarInspeccion, guardarReporte, obtenerProyecto, puntosDeInspeccion, db, type Inspeccion } from './db';
import { fecha, fechaHora } from './fechas';

const VERDE = '#1B7F3B';
const NARANJO = '#E06C00';

// Evita que textos con < > & rompan el HTML del PDF
const esc = (t: string | null | undefined) =>
  (t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

/** Genera el PDF, lo guarda en el teléfono, registra el reporte y devuelve su id. */
export async function generarReporte(inspeccionId: number, nombre: string): Promise<number> {
  const insp = await db.getFirstAsync<Inspeccion>('SELECT * FROM inspecciones WHERE id = ?', inspeccionId);
  if (!insp) throw new Error('No se encontró la inspección.');
  const proyecto = await obtenerProyecto(insp.proyecto_id);
  if (!proyecto) throw new Error('No se encontró el proyecto.');

  const puntos = await puntosDeInspeccion(inspeccionId);
  if (puntos.length === 0) throw new Error('La inspección no tiene puntos cerrados.');
  const cerrados = puntos.filter((p) => p.estado === 'Cerrado').length;
  const pendientes = puntos.length - cerrados;

  // Agrupar por sector (ya vienen ordenados por sector y punto)
  const sectores = new Map<string, typeof puntos>();
  for (const p of puntos) {
    if (!sectores.has(p.sector_nombre)) sectores.set(p.sector_nombre, []);
    sectores.get(p.sector_nombre)!.push(p);
  }

  let cuerpo = '';
  for (const [sector, lista] of sectores) {
    cuerpo += `<h2 class="sector">Sector: ${esc(sector)}</h2>`;
    for (const p of lista) {
      const color = p.estado === 'Cerrado' ? VERDE : NARANJO;
      let fotosHtml = '';
      for (const f of p.fotos) {
        const src = await fotoParaPdf(f.archivo);
        fotosHtml += `<div class="foto"><img src="${src}"></div>`;
      }
      cuerpo += `
        <div class="punto">
          <div class="punto-cab">
            <h3>${esc(p.punto_nombre)}</h3>
            <span class="estado" style="background:${color}">${esc(p.estado)}</span>
          </div>
          ${
            p.fecha_anterior
              ? `<p class="reinsp">REINSPECCIÓN · Inspección anterior: ${fechaHora(p.fecha_anterior)}</p>`
              : ''
          }
          <p class="obs"><b>Observación:</b> ${esc(p.observacion) || '<i>Sin observación</i>'}</p>
          <div class="fotos">${fotosHtml || '<p class="sinfotos">Sin fotos</p>'}</div>
        </div>`;
    }
  }

  const hoy = new Date().toISOString();
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 28px; }
  body { font-family: Helvetica, Arial, sans-serif; color: #111; font-size: 12px; }
  .cab { border-bottom: 3px solid #0B3D91; padding-bottom: 8px; margin-bottom: 12px; }
  .cab h1 { font-size: 20px; margin: 0 0 6px; color: #0B3D91; }
  .cab table { width: 100%; font-size: 12px; }
  .cab td { padding: 2px 0; }
  .resumen { display: flex; gap: 8px; margin-bottom: 16px; }
  .caja { flex: 1; border-radius: 6px; padding: 8px; text-align: center; color: #fff; }
  .caja b { display: block; font-size: 22px; }
  .sector { font-size: 16px; background: #E8EDF5; padding: 6px 8px; margin: 18px 0 8px; border-left: 5px solid #0B3D91; }
  .punto { border: 1px solid #CCC; border-radius: 6px; padding: 8px; margin-bottom: 10px; }
  .punto-cab { display: flex; justify-content: space-between; align-items: center; }
  .punto-cab h3 { margin: 0; font-size: 14px; }
  .estado { color: #fff; font-weight: bold; padding: 3px 10px; border-radius: 10px; font-size: 12px; }
  .reinsp { color: ${NARANJO}; font-weight: bold; margin: 4px 0; }
  .obs { margin: 6px 0; }
  .fotos { display: flex; flex-wrap: wrap; gap: 6px; }
  .foto { width: 32%; page-break-inside: avoid; break-inside: avoid; }
  .foto img { width: 100%; height: auto; border-radius: 4px; display: block; }
  .sinfotos { color: #777; font-style: italic; }
</style></head>
<body>
  <div class="cab">
    <h1>${esc(nombre)}</h1>
    <table>
      <tr><td><b>Proyecto:</b> ${esc(proyecto.nombre)}</td><td><b>Código:</b> ${esc(proyecto.codigo)}</td></tr>
      <tr><td><b>Área:</b> ${esc(proyecto.area)}</td><td><b>Fecha:</b> ${fecha(hoy)}</td></tr>
    </table>
  </div>
  <div class="resumen">
    <div class="caja" style="background:#0B3D91"><b>${puntos.length}</b>Puntos inspeccionados</div>
    <div class="caja" style="background:${VERDE}"><b>${cerrados}</b>Cerrados</div>
    <div class="caja" style="background:${NARANJO}"><b>${pendientes}</b>Pendientes</div>
  </div>
  ${cuerpo}
</body></html>`;

  // Hoja A4 en puntos (595 x 842)
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const archivo = await guardarPdf(uri, nombre);
  await finalizarInspeccion(inspeccionId);
  return guardarReporte({
    proyecto_id: proyecto.id,
    inspeccion_id: inspeccionId,
    nombre,
    archivo,
    total: puntos.length,
    cerrados,
    pendientes,
  });
}
