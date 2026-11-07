// Base de datos local (SQLite). Todo queda guardado en el teléfono, sin internet.
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('inspecciones.db');

export type EstadoProyecto = 'Pendiente' | 'En ejecución' | 'Cerrado';
export const ESTADOS_PROYECTO: EstadoProyecto[] = ['Pendiente', 'En ejecución', 'Cerrado'];

// Estado de un punto a nivel de proyecto
export type EstadoPunto = 'Sin inspección' | 'Pendiente' | 'Cerrado';
// Estado con que se cierra un punto dentro de una inspección
export type EstadoCierre = 'Cerrado' | 'Pendiente';

export interface Proyecto {
  id: number;
  nombre: string;
  area: string;
  codigo: string;
  estado: EstadoProyecto;
  creado: string;
}

export interface Sector {
  id: number;
  proyecto_id: number;
  nombre: string;
}

export interface Punto {
  id: number;
  sector_id: number;
  nombre: string;
  estado: EstadoPunto;
}

export interface Inspeccion {
  id: number;
  proyecto_id: number;
  iniciada: string;
  finalizada: string | null;
}

// Una "inspección de punto": un punto revisado dentro de una inspección
export interface InspeccionPunto {
  id: number;
  inspeccion_id: number;
  punto_id: number;
  fecha: string;
  observacion: string | null;
  estado: EstadoCierre | null; // null = punto todavía abierto (tomando fotos)
  fecha_anterior: string | null; // si es reinspección, fecha de la inspección previa
}

export interface Foto {
  id: number;
  inspeccion_punto_id: number;
  archivo: string; // ruta relativa dentro de la carpeta de documentos de la app
  fecha: string;
}

export interface Reporte {
  id: number;
  proyecto_id: number;
  inspeccion_id: number;
  nombre: string;
  archivo: string;
  fecha: string;
  total: number;
  cerrados: number;
  pendientes: number;
}

export async function iniciarBaseDatos() {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS proyectos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      area TEXT NOT NULL,
      codigo TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Pendiente',
      creado TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sectores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS puntos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sector_id INTEGER NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Sin inspección'
    );

    CREATE TABLE IF NOT EXISTS inspecciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      iniciada TEXT NOT NULL,
      finalizada TEXT
    );

    CREATE TABLE IF NOT EXISTS inspeccion_puntos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspeccion_id INTEGER NOT NULL REFERENCES inspecciones(id) ON DELETE CASCADE,
      punto_id INTEGER NOT NULL REFERENCES puntos(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      observacion TEXT,
      estado TEXT,
      fecha_anterior TEXT,
      UNIQUE (inspeccion_id, punto_id)
    );

    CREATE TABLE IF NOT EXISTS fotos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspeccion_punto_id INTEGER NOT NULL REFERENCES inspeccion_puntos(id) ON DELETE CASCADE,
      archivo TEXT NOT NULL,
      fecha TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reportes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      inspeccion_id INTEGER NOT NULL REFERENCES inspecciones(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      archivo TEXT NOT NULL,
      fecha TEXT NOT NULL,
      total INTEGER NOT NULL,
      cerrados INTEGER NOT NULL,
      pendientes INTEGER NOT NULL
    );
  `);
}

const ahora = () => new Date().toISOString();

// ---------- Proyectos ----------

export function listarProyectos(estado?: EstadoProyecto) {
  if (estado) {
    return db.getAllAsync<Proyecto>(
      'SELECT * FROM proyectos WHERE estado = ? ORDER BY creado DESC',
      estado
    );
  }
  return db.getAllAsync<Proyecto>('SELECT * FROM proyectos ORDER BY creado DESC');
}

export function obtenerProyecto(id: number) {
  return db.getFirstAsync<Proyecto>('SELECT * FROM proyectos WHERE id = ?', id);
}

export async function crearProyecto(nombre: string, area: string, codigo: string) {
  const r = await db.runAsync(
    'INSERT INTO proyectos (nombre, area, codigo, estado, creado) VALUES (?, ?, ?, ?, ?)',
    nombre, area, codigo, 'Pendiente', ahora()
  );
  return r.lastInsertRowId;
}

export async function editarProyecto(id: number, nombre: string, area: string, codigo: string) {
  await db.runAsync(
    'UPDATE proyectos SET nombre = ?, area = ?, codigo = ? WHERE id = ?',
    nombre, area, codigo, id
  );
}

export async function cambiarEstadoProyecto(id: number, estado: EstadoProyecto) {
  await db.runAsync('UPDATE proyectos SET estado = ? WHERE id = ?', estado, id);
}

export async function eliminarProyecto(id: number) {
  const archivos = await db.getAllAsync<{ archivo: string }>(
    `SELECT f.archivo FROM fotos f
     JOIN inspeccion_puntos ip ON ip.id = f.inspeccion_punto_id
     JOIN inspecciones i ON i.id = ip.inspeccion_id
     WHERE i.proyecto_id = ?
     UNION ALL
     SELECT archivo FROM reportes WHERE proyecto_id = ?`,
    id, id
  );
  await db.runAsync('DELETE FROM proyectos WHERE id = ?', id);
  return archivos.map((a) => a.archivo);
}

// ---------- Sectores y puntos ----------

export function listarSectores(proyectoId: number) {
  return db.getAllAsync<Sector>(
    'SELECT * FROM sectores WHERE proyecto_id = ? ORDER BY nombre COLLATE NOCASE',
    proyectoId
  );
}

export async function crearSector(proyectoId: number, nombre: string) {
  await db.runAsync('INSERT INTO sectores (proyecto_id, nombre) VALUES (?, ?)', proyectoId, nombre);
}

export async function renombrarSector(id: number, nombre: string) {
  await db.runAsync('UPDATE sectores SET nombre = ? WHERE id = ?', nombre, id);
}

export async function eliminarSector(id: number) {
  const archivos = await db.getAllAsync<{ archivo: string }>(
    `SELECT f.archivo FROM fotos f
     JOIN inspeccion_puntos ip ON ip.id = f.inspeccion_punto_id
     JOIN puntos p ON p.id = ip.punto_id
     WHERE p.sector_id = ?`,
    id
  );
  await db.runAsync('DELETE FROM sectores WHERE id = ?', id);
  return archivos.map((a) => a.archivo);
}

export function listarPuntos(sectorId: number) {
  return db.getAllAsync<Punto>(
    'SELECT * FROM puntos WHERE sector_id = ? ORDER BY nombre COLLATE NOCASE',
    sectorId
  );
}

export function obtenerPunto(id: number) {
  return db.getFirstAsync<Punto & { sector_nombre: string; proyecto_id: number }>(
    `SELECT p.*, s.nombre AS sector_nombre, s.proyecto_id
     FROM puntos p JOIN sectores s ON s.id = p.sector_id WHERE p.id = ?`,
    id
  );
}

export async function crearPunto(sectorId: number, nombre: string) {
  await db.runAsync('INSERT INTO puntos (sector_id, nombre) VALUES (?, ?)', sectorId, nombre);
}

export async function renombrarPunto(id: number, nombre: string) {
  await db.runAsync('UPDATE puntos SET nombre = ? WHERE id = ?', nombre, id);
}

export async function eliminarPunto(id: number) {
  const archivos = await db.getAllAsync<{ archivo: string }>(
    `SELECT f.archivo FROM fotos f
     JOIN inspeccion_puntos ip ON ip.id = f.inspeccion_punto_id
     WHERE ip.punto_id = ?`,
    id
  );
  await db.runAsync('DELETE FROM puntos WHERE id = ?', id);
  return archivos.map((a) => a.archivo);
}

export async function contarHistorialPunto(id: number) {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM inspeccion_puntos WHERE punto_id = ?',
    id
  );
  return r?.n ?? 0;
}

export function listarPuntosPendientes(proyectoId: number) {
  return db.getAllAsync<Punto & { sector_nombre: string; ultima_fecha: string | null; ultima_obs: string | null }>(
    `SELECT p.*, s.nombre AS sector_nombre,
       (SELECT ip.fecha FROM inspeccion_puntos ip
          WHERE ip.punto_id = p.id AND ip.estado IS NOT NULL
          ORDER BY ip.fecha DESC LIMIT 1) AS ultima_fecha,
       (SELECT ip.observacion FROM inspeccion_puntos ip
          WHERE ip.punto_id = p.id AND ip.estado IS NOT NULL
          ORDER BY ip.fecha DESC LIMIT 1) AS ultima_obs
     FROM puntos p JOIN sectores s ON s.id = p.sector_id
     WHERE s.proyecto_id = ? AND p.estado = 'Pendiente'
     ORDER BY s.nombre COLLATE NOCASE, p.nombre COLLATE NOCASE`,
    proyectoId
  );
}

// ---------- Inspecciones ----------

export function inspeccionEnCurso(proyectoId: number) {
  return db.getFirstAsync<Inspeccion>(
    'SELECT * FROM inspecciones WHERE proyecto_id = ? AND finalizada IS NULL ORDER BY id DESC LIMIT 1',
    proyectoId
  );
}

export async function crearInspeccion(proyectoId: number) {
  const r = await db.runAsync(
    'INSERT INTO inspecciones (proyecto_id, iniciada) VALUES (?, ?)',
    proyectoId, ahora()
  );
  return r.lastInsertRowId;
}

export async function descartarInspeccion(id: number) {
  const archivos = await db.getAllAsync<{ archivo: string }>(
    `SELECT f.archivo FROM fotos f
     JOIN inspeccion_puntos ip ON ip.id = f.inspeccion_punto_id
     WHERE ip.inspeccion_id = ?`,
    id
  );
  // Al descartar, los puntos vuelven al estado que tenían antes de esta inspección
  const afectados = await db.getAllAsync<{ punto_id: number }>(
    'SELECT punto_id FROM inspeccion_puntos WHERE inspeccion_id = ? AND estado IS NOT NULL',
    id
  );
  await db.runAsync('DELETE FROM inspecciones WHERE id = ?', id);
  for (const a of afectados) await recalcularEstadoPunto(a.punto_id);
  return archivos.map((a) => a.archivo);
}

async function recalcularEstadoPunto(puntoId: number) {
  const ultima = await db.getFirstAsync<{ estado: EstadoCierre }>(
    `SELECT estado FROM inspeccion_puntos
     WHERE punto_id = ? AND estado IS NOT NULL ORDER BY fecha DESC LIMIT 1`,
    puntoId
  );
  await db.runAsync(
    'UPDATE puntos SET estado = ? WHERE id = ?',
    ultima?.estado ?? 'Sin inspección', puntoId
  );
}

export async function finalizarInspeccion(id: number) {
  await db.runAsync('UPDATE inspecciones SET finalizada = ? WHERE id = ?', ahora(), id);
}

// Puntos que se pueden elegir en esta inspección: no cerrados y no usados ya en ella
export function puntosDisponibles(sectorId: number, inspeccionId: number) {
  return db.getAllAsync<Punto>(
    `SELECT * FROM puntos
     WHERE sector_id = ? AND estado != 'Cerrado'
       AND id NOT IN (SELECT punto_id FROM inspeccion_puntos WHERE inspeccion_id = ?)
     ORDER BY nombre COLLATE NOCASE`,
    sectorId, inspeccionId
  );
}

// Sectores que todavía tienen al menos un punto disponible
export function sectoresDisponibles(proyectoId: number, inspeccionId: number) {
  return db.getAllAsync<Sector>(
    `SELECT s.* FROM sectores s
     WHERE s.proyecto_id = ? AND EXISTS (
       SELECT 1 FROM puntos p WHERE p.sector_id = s.id AND p.estado != 'Cerrado'
         AND p.id NOT IN (SELECT punto_id FROM inspeccion_puntos WHERE inspeccion_id = ?)
     )
     ORDER BY s.nombre COLLATE NOCASE`,
    proyectoId, inspeccionId
  );
}

// Punto que quedó abierto (con fotos pero sin cerrar), por ejemplo si se cerró la app
export function puntoAbierto(inspeccionId: number) {
  return db.getFirstAsync<InspeccionPunto>(
    'SELECT * FROM inspeccion_puntos WHERE inspeccion_id = ? AND estado IS NULL LIMIT 1',
    inspeccionId
  );
}

export async function contarPuntosCerradosEnInspeccion(inspeccionId: number) {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM inspeccion_puntos WHERE inspeccion_id = ? AND estado IS NOT NULL',
    inspeccionId
  );
  return r?.n ?? 0;
}

export async function abrirPuntoEnInspeccion(inspeccionId: number, puntoId: number) {
  const anterior = await db.getFirstAsync<{ fecha: string }>(
    `SELECT fecha FROM inspeccion_puntos
     WHERE punto_id = ? AND estado IS NOT NULL ORDER BY fecha DESC LIMIT 1`,
    puntoId
  );
  const r = await db.runAsync(
    'INSERT INTO inspeccion_puntos (inspeccion_id, punto_id, fecha, fecha_anterior) VALUES (?, ?, ?, ?)',
    inspeccionId, puntoId, ahora(), anterior?.fecha ?? null
  );
  return r.lastInsertRowId;
}

export async function cerrarPuntoEnInspeccion(
  inspeccionPuntoId: number,
  observacion: string,
  estado: EstadoCierre
) {
  const ip = await db.getFirstAsync<InspeccionPunto>(
    'SELECT * FROM inspeccion_puntos WHERE id = ?',
    inspeccionPuntoId
  );
  if (!ip) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE inspeccion_puntos SET observacion = ?, estado = ? WHERE id = ?',
      observacion, estado, inspeccionPuntoId
    );
    await db.runAsync('UPDATE puntos SET estado = ? WHERE id = ?', estado, ip.punto_id);
  });
}

// ---------- Fotos ----------

export async function agregarFoto(inspeccionPuntoId: number, archivo: string) {
  await db.runAsync(
    'INSERT INTO fotos (inspeccion_punto_id, archivo, fecha) VALUES (?, ?, ?)',
    inspeccionPuntoId, archivo, ahora()
  );
}

export function listarFotos(inspeccionPuntoId: number) {
  return db.getAllAsync<Foto>(
    'SELECT * FROM fotos WHERE inspeccion_punto_id = ? ORDER BY id',
    inspeccionPuntoId
  );
}

export async function eliminarFoto(id: number) {
  const f = await db.getFirstAsync<Foto>('SELECT * FROM fotos WHERE id = ?', id);
  await db.runAsync('DELETE FROM fotos WHERE id = ?', id);
  return f?.archivo;
}

// ---------- Historial de un punto ----------

export function historialPunto(puntoId: number) {
  return db.getAllAsync<InspeccionPunto>(
    `SELECT * FROM inspeccion_puntos WHERE punto_id = ? AND estado IS NOT NULL ORDER BY fecha DESC`,
    puntoId
  );
}

// ---------- Datos para el PDF ----------

export interface PuntoDelReporte extends InspeccionPunto {
  punto_nombre: string;
  sector_nombre: string;
  fotos: Foto[];
}

export async function puntosDeInspeccion(inspeccionId: number): Promise<PuntoDelReporte[]> {
  const filas = await db.getAllAsync<InspeccionPunto & { punto_nombre: string; sector_nombre: string }>(
    `SELECT ip.*, p.nombre AS punto_nombre, s.nombre AS sector_nombre
     FROM inspeccion_puntos ip
     JOIN puntos p ON p.id = ip.punto_id
     JOIN sectores s ON s.id = p.sector_id
     WHERE ip.inspeccion_id = ? AND ip.estado IS NOT NULL
     ORDER BY s.nombre COLLATE NOCASE, p.nombre COLLATE NOCASE`,
    inspeccionId
  );
  const resultado: PuntoDelReporte[] = [];
  for (const f of filas) resultado.push({ ...f, fotos: await listarFotos(f.id) });
  return resultado;
}

// ---------- Reportes ----------

export async function guardarReporte(r: Omit<Reporte, 'id' | 'fecha'>) {
  const res = await db.runAsync(
    `INSERT INTO reportes (proyecto_id, inspeccion_id, nombre, archivo, fecha, total, cerrados, pendientes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    r.proyecto_id, r.inspeccion_id, r.nombre, r.archivo, ahora(), r.total, r.cerrados, r.pendientes
  );
  return res.lastInsertRowId;
}

export function listarReportes(proyectoId: number) {
  return db.getAllAsync<Reporte>(
    'SELECT * FROM reportes WHERE proyecto_id = ? ORDER BY fecha DESC',
    proyectoId
  );
}

export function obtenerReporte(id: number) {
  return db.getFirstAsync<Reporte>('SELECT * FROM reportes WHERE id = ?', id);
}
