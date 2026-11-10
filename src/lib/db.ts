// Base de datos local (SQLite). Todo queda guardado en el teléfono, sin internet.
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// En el teléfono la base se abre de inmediato. En web (modo demostración en el PC) hay que abrirla
// de forma asíncrona, porque el motor SQLite se carga en segundo plano; se asigna en iniciarBaseDatos().
export let db: SQLite.SQLiteDatabase = Platform.OS === 'web' ? (null as unknown as SQLite.SQLiteDatabase) : SQLite.openDatabaseSync('inspecciones.db');

export type EstadoProyecto = 'Pendiente' | 'En ejecución' | 'Cerrado';
export const ESTADOS_PROYECTO: EstadoProyecto[] = ['Pendiente', 'En ejecución', 'Cerrado'];

// Estado de un punto a nivel de proyecto. "Sin inspección" = todavía por revisar.
export type EstadoPunto = 'Sin inspección' | 'Pendiente' | 'Cerrado' | 'Anulado';
// Estado con que se cierra un punto dentro de una inspección
export type EstadoCierre = 'Cerrado' | 'Pendiente' | 'Anulado';
export const ESTADOS_CIERRE: EstadoCierre[] = ['Cerrado', 'Pendiente', 'Anulado'];

export type TipoInspeccion = 'Inspección' | 'Re-Inspección';

export const nombreInspeccion = (tipo: TipoInspeccion, numero: number) =>
  tipo === 'Inspección' ? 'Primera Inspección' : `Re-Inspección N° ${numero}`;
export type TipoAlcance = 'Incluido' | 'Excluido';

export interface Proyecto {
  id: number;
  nombre: string;
  area: string;
  codigo: string;
  revision: string;
  contratista: string;
  contrato: string;
  estado: EstadoProyecto;
  creado: string;
}

export interface ItemAlcance {
  id?: number;
  tipo: TipoAlcance;
  texto: string;
}

export interface Documento {
  id?: number;
  codigo: string;
  titulo: string;
  rev: string;
}

export interface Sector {
  id: number;
  proyecto_id: number;
  nombre: string;
}

export interface Punto {
  id: number;
  sector_id: number;
  numero: number; // N° fijo dentro del proyecto, igual en todos los reportes
  nombre: string;
  estado: EstadoPunto;
}

export interface Inspeccion {
  id: number;
  proyecto_id: number;
  tipo: TipoInspeccion;
  numero: number; // 0 = primera inspección; 1, 2, 3... = Re-Inspección N°
  fecha: string; // AAAA-MM-DD
  sector_area: string;
  personal: string;
  iniciada: string;
  finalizada: string | null;
  proxima_fecha: string | null;
  proxima_responsable: string | null;
}

// Una "inspección de punto": un punto revisado dentro de una inspección
export interface InspeccionPunto {
  id: number;
  inspeccion_id: number;
  punto_id: number;
  fecha: string;
  observacion: string | null; // observación, verificación (RI) o motivo de anulación
  estado: EstadoCierre | null; // null = punto todavía abierto (tomando fotos)
  fecha_anterior: string | null;
  doc_detalle: string | null; // detalle del documento de referencia (si es pendiente)
}

export interface Foto {
  id: number;
  inspeccion_punto_id: number;
  archivo: string; // ruta relativa dentro de la carpeta de documentos de la app
  pie: string | null; // texto bajo la foto en el reporte
  fecha: string;
}

export interface Reporte {
  id: number;
  proyecto_id: number;
  inspeccion_id: number;
  tipo: TipoInspeccion | null; // null = reporte del formato antiguo
  codigo: string | null;
  nombre: string;
  archivo: string;
  fecha: string;
  total: number;
  cerrados: number;
  pendientes: number;
  anulados: number;
}

export interface Ajustes {
  inspector_nombre: string;
  inspector_cargo: string;
}

// ---------- Creación y migración ----------

export async function iniciarBaseDatos() {
  if (Platform.OS === 'web' && !db) db = await SQLite.openDatabaseAsync('inspecciones.db');
  // Estructura original (versión 0). Se mantiene tal cual para que las migraciones
  // de abajo funcionen igual en una instalación nueva y en una que ya tiene datos.
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

  const version = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (version < 1) {
    // En web (solo para capturas y pruebas en el PC) no existen las transacciones exclusivas
    if (Platform.OS === 'web') await db.withTransactionAsync(() => migrarAVersion1(db));
    else await db.withExclusiveTransactionAsync(migrarAVersion1);
  }
}

/**
 * Versión 1: inspección y re-inspecciones, datos ampliados del proyecto, estado ANULADO,
 * N° fijo de cada punto, documentos de referencia y ajustes del inspector.
 * Solo agrega columnas y tablas: no borra ningún dato existente.
 */
async function migrarAVersion1(tx: SQLite.SQLiteDatabase) {
  await tx.execAsync(`
    ALTER TABLE proyectos ADD COLUMN revision TEXT NOT NULL DEFAULT '0';
    ALTER TABLE proyectos ADD COLUMN contratista TEXT NOT NULL DEFAULT '';
    ALTER TABLE proyectos ADD COLUMN contrato TEXT NOT NULL DEFAULT '';
    ALTER TABLE puntos ADD COLUMN numero INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE inspecciones ADD COLUMN tipo TEXT NOT NULL DEFAULT 'Inspección';
    ALTER TABLE inspecciones ADD COLUMN numero INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE inspecciones ADD COLUMN fecha TEXT NOT NULL DEFAULT '';
    ALTER TABLE inspecciones ADD COLUMN sector_area TEXT NOT NULL DEFAULT '';
    ALTER TABLE inspecciones ADD COLUMN personal TEXT NOT NULL DEFAULT '';
    ALTER TABLE inspecciones ADD COLUMN proxima_fecha TEXT;
    ALTER TABLE inspecciones ADD COLUMN proxima_responsable TEXT;
    ALTER TABLE inspeccion_puntos ADD COLUMN doc_detalle TEXT;
    ALTER TABLE fotos ADD COLUMN pie TEXT;
    ALTER TABLE reportes ADD COLUMN tipo TEXT;
    ALTER TABLE reportes ADD COLUMN codigo TEXT;
    ALTER TABLE reportes ADD COLUMN anulados INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE alcance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      texto TEXT NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      codigo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      rev TEXT NOT NULL DEFAULT '',
      orden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE inspeccion_punto_docs (
      inspeccion_punto_id INTEGER NOT NULL REFERENCES inspeccion_puntos(id) ON DELETE CASCADE,
      documento_id INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
      PRIMARY KEY (inspeccion_punto_id, documento_id)
    );
    CREATE TABLE ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);

    -- N° de cada punto: orden de creación dentro de su proyecto
    UPDATE puntos SET numero = (
      SELECT COUNT(*) FROM puntos p2 JOIN sectores s2 ON s2.id = p2.sector_id
      WHERE s2.proyecto_id = (SELECT proyecto_id FROM sectores WHERE id = puntos.sector_id)
        AND p2.id <= puntos.id
    );

    -- Inspecciones existentes: la primera de cada proyecto es la "Primera Inspección",
    -- las siguientes pasan a ser Re-Inspección N°1, N°2...
    UPDATE inspecciones SET numero = (
      SELECT COUNT(*) FROM inspecciones i2
      WHERE i2.proyecto_id = inspecciones.proyecto_id AND i2.id < inspecciones.id
    );
    UPDATE inspecciones SET tipo = CASE WHEN numero = 0 THEN 'Inspección' ELSE 'Re-Inspección' END;
    UPDATE inspecciones SET fecha = substr(iniciada, 1, 10);

    -- Reportes antiguos: se mantienen y se les asigna su código
    UPDATE reportes SET
      tipo = (SELECT tipo FROM inspecciones WHERE id = reportes.inspeccion_id),
      codigo = (SELECT p.codigo || CASE WHEN i.numero > 0 THEN '-RI' || i.numero ELSE '' END
                FROM inspecciones i JOIN proyectos p ON p.id = i.proyecto_id
                WHERE i.id = reportes.inspeccion_id);

    PRAGMA user_version = 1;
  `);
}

const ahora = () => new Date().toISOString();

// ---------- Ajustes generales ----------

export async function obtenerAjustes(): Promise<Ajustes> {
  const filas = await db.getAllAsync<{ clave: string; valor: string }>('SELECT * FROM ajustes');
  const mapa = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  return { inspector_nombre: mapa.inspector_nombre ?? '', inspector_cargo: mapa.inspector_cargo ?? '' };
}

export async function guardarAjustes(a: Ajustes) {
  for (const [clave, valor] of Object.entries(a)) {
    await db.runAsync('INSERT OR REPLACE INTO ajustes (clave, valor) VALUES (?, ?)', clave, valor);
  }
}

// ---------- Proyectos ----------

export function listarProyectos(estado?: EstadoProyecto) {
  if (estado) {
    return db.getAllAsync<Proyecto>('SELECT * FROM proyectos WHERE estado = ? ORDER BY creado DESC', estado);
  }
  return db.getAllAsync<Proyecto>('SELECT * FROM proyectos ORDER BY creado DESC');
}

export function obtenerProyecto(id: number) {
  return db.getFirstAsync<Proyecto>('SELECT * FROM proyectos WHERE id = ?', id);
}

export type DatosProyecto = Pick<Proyecto, 'nombre' | 'area' | 'codigo' | 'revision' | 'contratista' | 'contrato'>;

/** Crea o actualiza un proyecto junto con su alcance y documentos de referencia. Devuelve el id. */
export async function guardarProyecto(
  id: number | null,
  datos: DatosProyecto,
  alcance: ItemAlcance[],
  documentos: Documento[]
): Promise<number> {
  let proyectoId = id ?? 0;
  await db.withTransactionAsync(async () => {
    if (id) {
      await db.runAsync(
        `UPDATE proyectos SET nombre = ?, area = ?, codigo = ?, revision = ?, contratista = ?, contrato = ?
         WHERE id = ?`,
        datos.nombre, datos.area, datos.codigo, datos.revision, datos.contratista, datos.contrato, id
      );
    } else {
      const r = await db.runAsync(
        `INSERT INTO proyectos (nombre, area, codigo, revision, contratista, contrato, estado, creado)
         VALUES (?, ?, ?, ?, ?, ?, 'Pendiente', ?)`,
        datos.nombre, datos.area, datos.codigo, datos.revision, datos.contratista, datos.contrato, ahora()
      );
      proyectoId = r.lastInsertRowId;
    }

    // El alcance no tiene referencias: se reemplaza completo
    await db.runAsync('DELETE FROM alcance WHERE proyecto_id = ?', proyectoId);
    for (const [orden, a] of alcance.entries()) {
      await db.runAsync(
        'INSERT INTO alcance (proyecto_id, tipo, texto, orden) VALUES (?, ?, ?, ?)',
        proyectoId, a.tipo, a.texto, orden
      );
    }

    // Los documentos pueden estar citados en puntos pendientes: se actualizan sin cambiar su id
    const conservar = documentos.filter((d) => d.id).map((d) => d.id!);
    if (conservar.length) {
      await db.runAsync(
        `DELETE FROM documentos WHERE proyecto_id = ? AND id NOT IN (${conservar.map(() => '?').join(',')})`,
        proyectoId, ...conservar
      );
    } else {
      await db.runAsync('DELETE FROM documentos WHERE proyecto_id = ?', proyectoId);
    }
    for (const [orden, d] of documentos.entries()) {
      if (d.id) {
        await db.runAsync(
          'UPDATE documentos SET codigo = ?, titulo = ?, rev = ?, orden = ? WHERE id = ?',
          d.codigo, d.titulo, d.rev, orden, d.id
        );
      } else {
        await db.runAsync(
          'INSERT INTO documentos (proyecto_id, codigo, titulo, rev, orden) VALUES (?, ?, ?, ?, ?)',
          proyectoId, d.codigo, d.titulo, d.rev, orden
        );
      }
    }
  });
  return proyectoId;
}

export function listarAlcance(proyectoId: number) {
  return db.getAllAsync<ItemAlcance>(
    'SELECT id, tipo, texto FROM alcance WHERE proyecto_id = ? ORDER BY orden',
    proyectoId
  );
}

export function listarDocumentos(proyectoId: number) {
  return db.getAllAsync<Documento & { id: number }>(
    'SELECT id, codigo, titulo, rev FROM documentos WHERE proyecto_id = ? ORDER BY orden',
    proyectoId
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

/** Cantidad de puntos del proyecto en cada estado. */
export async function resumenPuntos(proyectoId: number) {
  const filas = await db.getAllAsync<{ estado: EstadoPunto; n: number }>(
    `SELECT p.estado, COUNT(*) AS n FROM puntos p JOIN sectores s ON s.id = p.sector_id
     WHERE s.proyecto_id = ? GROUP BY p.estado`,
    proyectoId
  );
  const r = { total: 0, porRevisar: 0, cerrados: 0, pendientes: 0, anulados: 0 };
  for (const f of filas) {
    r.total += f.n;
    if (f.estado === 'Cerrado') r.cerrados = f.n;
    else if (f.estado === 'Pendiente') r.pendientes = f.n;
    else if (f.estado === 'Anulado') r.anulados = f.n;
    else r.porRevisar = f.n;
  }
  return r;
}

// ---------- Dashboards ----------

export interface ResumenInspeccion {
  id: number;
  tipo: TipoInspeccion;
  numero: number;
  fecha: string;
  finalizada: string | null;
  total: number;
  cerrados: number;
  pendientes: number;
  anulados: number;
}

/** Inspecciones del proyecto por fecha, con cuántos puntos se cerraron, anularon o quedaron pendientes. */
export function inspeccionesDelProyecto(proyectoId: number) {
  return db.getAllAsync<ResumenInspeccion>(
    `SELECT i.id, i.tipo, i.numero, i.fecha, i.finalizada,
       COUNT(ip.id) AS total,
       COALESCE(SUM(ip.estado = 'Cerrado'), 0) AS cerrados,
       COALESCE(SUM(ip.estado = 'Pendiente'), 0) AS pendientes,
       COALESCE(SUM(ip.estado = 'Anulado'), 0) AS anulados
     FROM inspecciones i
     LEFT JOIN inspeccion_puntos ip ON ip.inspeccion_id = i.id AND ip.estado IS NOT NULL
     WHERE i.proyecto_id = ?
     GROUP BY i.id
     ORDER BY i.fecha DESC, i.id DESC`,
    proyectoId
  );
}

export interface AvanceProyecto {
  id: number;
  nombre: string;
  codigo: string;
  estado: EstadoProyecto;
  total: number;
  cerrados: number;
  pendientes: number;
  anulados: number;
  porRevisar: number;
}

/** Puntos de cada proyecto por estado, para el dashboard general. */
export function avanceProyectos() {
  return db.getAllAsync<AvanceProyecto>(
    `SELECT pr.id, pr.nombre, pr.codigo, pr.estado,
       COUNT(p.id) AS total,
       COALESCE(SUM(p.estado = 'Cerrado'), 0) AS cerrados,
       COALESCE(SUM(p.estado = 'Pendiente'), 0) AS pendientes,
       COALESCE(SUM(p.estado = 'Anulado'), 0) AS anulados,
       COALESCE(SUM(p.estado = 'Sin inspección'), 0) AS porRevisar
     FROM proyectos pr
     LEFT JOIN sectores s ON s.proyecto_id = pr.id
     LEFT JOIN puntos p ON p.sector_id = s.id
     GROUP BY pr.id
     ORDER BY pr.creado DESC`
  );
}

/** % de avance: puntos cerrados sobre los que aplican (los anulados no cuentan). */
export function porcentajeAvance(p: { total: number; cerrados: number; anulados: number }) {
  const aplican = p.total - p.anulados;
  return aplican > 0 ? Math.round((p.cerrados / aplican) * 100) : 0;
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
  return db.getAllAsync<Punto>('SELECT * FROM puntos WHERE sector_id = ? ORDER BY numero', sectorId);
}

export function obtenerPunto(id: number) {
  return db.getFirstAsync<Punto & { sector_nombre: string; proyecto_id: number }>(
    `SELECT p.*, s.nombre AS sector_nombre, s.proyecto_id
     FROM puntos p JOIN sectores s ON s.id = p.sector_id WHERE p.id = ?`,
    id
  );
}

/** Crea un punto con el N° siguiente del proyecto (los N° nunca se reutilizan ni cambian). */
export async function crearPunto(sectorId: number, nombre: string) {
  await db.runAsync(
    `INSERT INTO puntos (sector_id, nombre, numero) VALUES (?, ?, (
       SELECT COALESCE(MAX(p.numero), 0) + 1 FROM puntos p JOIN sectores s ON s.id = p.sector_id
       WHERE s.proyecto_id = (SELECT proyecto_id FROM sectores WHERE id = ?)
     ))`,
    sectorId, nombre, sectorId
  );
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

export type PuntoPendiente = Punto & {
  sector_nombre: string;
  ultima_fecha: string | null;
  ultima_obs: string | null;
};

/** Puntos con hallazgo pendiente o todavía sin revisar (por ejemplo, agregados después). */
export function listarPuntosPendientes(proyectoId: number) {
  return db.getAllAsync<PuntoPendiente>(
    `SELECT p.*, s.nombre AS sector_nombre,
       (SELECT ip.fecha FROM inspeccion_puntos ip
          WHERE ip.punto_id = p.id AND ip.estado IS NOT NULL ORDER BY ip.fecha DESC LIMIT 1) AS ultima_fecha,
       (SELECT ip.observacion FROM inspeccion_puntos ip
          WHERE ip.punto_id = p.id AND ip.estado IS NOT NULL ORDER BY ip.fecha DESC LIMIT 1) AS ultima_obs
     FROM puntos p JOIN sectores s ON s.id = p.sector_id
     WHERE s.proyecto_id = ? AND p.estado IN ('Pendiente', 'Sin inspección')
     ORDER BY p.numero`,
    proyectoId
  );
}

// ---------- Inspecciones ----------

export function obtenerInspeccion(id: number) {
  return db.getFirstAsync<Inspeccion>('SELECT * FROM inspecciones WHERE id = ?', id);
}

export function inspeccionEnCurso(proyectoId: number) {
  return db.getFirstAsync<Inspeccion>(
    'SELECT * FROM inspecciones WHERE proyecto_id = ? AND finalizada IS NULL ORDER BY id DESC LIMIT 1',
    proyectoId
  );
}

/** La Primera Inspección ya finalizada del proyecto (null si todavía no se hace). */
export function primeraInspeccion(proyectoId: number) {
  return db.getFirstAsync<Inspeccion>(
    `SELECT * FROM inspecciones WHERE proyecto_id = ? AND tipo = 'Inspección' AND finalizada IS NOT NULL
     ORDER BY id LIMIT 1`,
    proyectoId
  );
}

/** Tipo y N° que tendrá la próxima inspección del proyecto. */
export async function siguienteInspeccion(proyectoId: number): Promise<{ tipo: TipoInspeccion; numero: number }> {
  if (!(await primeraInspeccion(proyectoId))) return { tipo: 'Inspección', numero: 0 };
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COALESCE(MAX(numero), 0) AS n FROM inspecciones WHERE proyecto_id = ? AND finalizada IS NOT NULL',
    proyectoId
  );
  return { tipo: 'Re-Inspección', numero: (r?.n ?? 0) + 1 };
}

export async function crearInspeccion(
  proyectoId: number,
  datos: { fecha: string; sector_area: string; personal: string }
) {
  const { tipo, numero } = await siguienteInspeccion(proyectoId);
  const r = await db.runAsync(
    `INSERT INTO inspecciones (proyecto_id, tipo, numero, fecha, sector_area, personal, iniciada)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    proyectoId, tipo, numero, datos.fecha, datos.sector_area, datos.personal, ahora()
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
  await db.runAsync('UPDATE puntos SET estado = ? WHERE id = ?', ultima?.estado ?? 'Sin inspección', puntoId);
}

export async function finalizarInspeccion(id: number) {
  await db.runAsync('UPDATE inspecciones SET finalizada = ? WHERE id = ?', ahora(), id);
}

export async function guardarProximaVisita(id: number, fecha: string | null, responsable: string | null) {
  await db.runAsync(
    'UPDATE inspecciones SET proxima_fecha = ?, proxima_responsable = ? WHERE id = ?',
    fecha, responsable, id
  );
}

// Un punto se puede revisar si está por revisar o pendiente, y no se usó ya en esta inspección.
// Los cerrados y anulados no vuelven a aparecer.
const DISPONIBLE = `p.estado IN ('Sin inspección', 'Pendiente')
  AND p.id NOT IN (SELECT punto_id FROM inspeccion_puntos WHERE inspeccion_id = ?)`;

export function puntosDisponibles(sectorId: number, inspeccionId: number) {
  return db.getAllAsync<Punto>(
    `SELECT p.* FROM puntos p WHERE p.sector_id = ? AND ${DISPONIBLE} ORDER BY p.numero`,
    sectorId, inspeccionId
  );
}

export function sectoresDisponibles(proyectoId: number, inspeccionId: number) {
  return db.getAllAsync<Sector>(
    `SELECT s.* FROM sectores s
     WHERE s.proyecto_id = ? AND EXISTS (SELECT 1 FROM puntos p WHERE p.sector_id = s.id AND ${DISPONIBLE})
     ORDER BY s.nombre COLLATE NOCASE`,
    proyectoId, inspeccionId
  );
}

/** Puntos que quedaron sin revisar en esta inspección. */
export function puntosSinRevisar(proyectoId: number, inspeccionId: number) {
  return db.getAllAsync<Punto>(
    `SELECT p.* FROM puntos p JOIN sectores s ON s.id = p.sector_id
     WHERE s.proyecto_id = ? AND ${DISPONIBLE} ORDER BY p.numero`,
    proyectoId, inspeccionId
  );
}

/** Anula puntos sin revisar al cerrar la primera inspección (quedan registrados en el reporte). */
export async function anularPuntos(inspeccionId: number, puntoIds: number[], motivo: string) {
  await db.withTransactionAsync(async () => {
    for (const puntoId of puntoIds) {
      const id = await abrirPuntoEnInspeccion(inspeccionId, puntoId);
      await db.runAsync("UPDATE inspeccion_puntos SET observacion = ?, estado = 'Anulado' WHERE id = ?", motivo, id);
      await db.runAsync("UPDATE puntos SET estado = 'Anulado' WHERE id = ?", puntoId);
    }
  });
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
  datos: { observacion: string; estado: EstadoCierre; documentos: number[]; detalle: string }
) {
  const ip = await db.getFirstAsync<InspeccionPunto>('SELECT * FROM inspeccion_puntos WHERE id = ?', inspeccionPuntoId);
  if (!ip) return;
  const pendiente = datos.estado === 'Pendiente';
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE inspeccion_puntos SET observacion = ?, estado = ?, doc_detalle = ? WHERE id = ?',
      datos.observacion, datos.estado, pendiente && datos.detalle ? datos.detalle : null, inspeccionPuntoId
    );
    await db.runAsync('DELETE FROM inspeccion_punto_docs WHERE inspeccion_punto_id = ?', inspeccionPuntoId);
    if (pendiente) {
      for (const d of datos.documentos) {
        await db.runAsync(
          'INSERT INTO inspeccion_punto_docs (inspeccion_punto_id, documento_id) VALUES (?, ?)',
          inspeccionPuntoId, d
        );
      }
    }
    await db.runAsync('UPDATE puntos SET estado = ? WHERE id = ?', datos.estado, ip.punto_id);
  });
}

/** Primer registro del punto en una inspección anterior: es el "hallazgo original". */
export function hallazgoOriginal(puntoId: number, inspeccionActual: number) {
  return db.getFirstAsync<InspeccionPunto>(
    `SELECT * FROM inspeccion_puntos
     WHERE punto_id = ? AND estado IS NOT NULL AND inspeccion_id != ?
     ORDER BY fecha LIMIT 1`,
    puntoId, inspeccionActual
  );
}

// ---------- Fotos ----------

export async function agregarFoto(inspeccionPuntoId: number, archivo: string, pie: string) {
  await db.runAsync(
    'INSERT INTO fotos (inspeccion_punto_id, archivo, pie, fecha) VALUES (?, ?, ?, ?)',
    inspeccionPuntoId, archivo, pie, ahora()
  );
}

export async function cambiarPieFoto(id: number, pie: string) {
  await db.runAsync('UPDATE fotos SET pie = ? WHERE id = ?', pie, id);
}

export function listarFotos(inspeccionPuntoId: number) {
  return db.getAllAsync<Foto>('SELECT * FROM fotos WHERE inspeccion_punto_id = ? ORDER BY id', inspeccionPuntoId);
}

export async function eliminarFoto(id: number) {
  const f = await db.getFirstAsync<Foto>('SELECT * FROM fotos WHERE id = ?', id);
  await db.runAsync('DELETE FROM fotos WHERE id = ?', id);
  return f?.archivo;
}

// ---------- Documentos citados en un punto ----------

export function documentosDePunto(inspeccionPuntoId: number) {
  return db.getAllAsync<Documento & { id: number }>(
    `SELECT d.id, d.codigo, d.titulo, d.rev FROM documentos d
     JOIN inspeccion_punto_docs x ON x.documento_id = d.id
     WHERE x.inspeccion_punto_id = ? ORDER BY d.orden`,
    inspeccionPuntoId
  );
}

// ---------- Historial de un punto ----------

export function historialPunto(puntoId: number) {
  return db.getAllAsync<InspeccionPunto & { tipo: TipoInspeccion; numero: number }>(
    `SELECT ip.*, i.tipo, i.numero FROM inspeccion_puntos ip JOIN inspecciones i ON i.id = ip.inspeccion_id
     WHERE ip.punto_id = ? AND ip.estado IS NOT NULL ORDER BY ip.fecha DESC`,
    puntoId
  );
}

// ---------- Datos para el PDF ----------

export interface PuntoDelReporte extends InspeccionPunto {
  punto_numero: number;
  punto_nombre: string;
  sector_nombre: string;
  fotos: Foto[];
  documentos: Documento[];
  hallazgo: InspeccionPunto | null; // solo en re-inspecciones
}

export async function puntosDeInspeccion(inspeccionId: number): Promise<PuntoDelReporte[]> {
  const filas = await db.getAllAsync<InspeccionPunto & { punto_numero: number; punto_nombre: string; sector_nombre: string }>(
    `SELECT ip.*, p.numero AS punto_numero, p.nombre AS punto_nombre, s.nombre AS sector_nombre
     FROM inspeccion_puntos ip
     JOIN puntos p ON p.id = ip.punto_id
     JOIN sectores s ON s.id = p.sector_id
     WHERE ip.inspeccion_id = ? AND ip.estado IS NOT NULL
     ORDER BY p.numero`,
    inspeccionId
  );
  const resultado: PuntoDelReporte[] = [];
  for (const f of filas) {
    resultado.push({
      ...f,
      fotos: await listarFotos(f.id),
      documentos: await documentosDePunto(f.id),
      hallazgo: await hallazgoOriginal(f.punto_id, inspeccionId),
    });
  }
  return resultado;
}

/** Reporte de una inspección anterior del mismo proyecto (para los antecedentes de una RI). */
export function inspeccionAnterior(proyectoId: number, tipo: TipoInspeccion, numero: number) {
  return db.getFirstAsync<Inspeccion & { codigo: string | null }>(
    `SELECT i.*, (SELECT r.codigo FROM reportes r WHERE r.inspeccion_id = i.id ORDER BY r.id DESC LIMIT 1) AS codigo
     FROM inspecciones i WHERE i.proyecto_id = ? AND i.tipo = ? AND i.numero = ? AND i.finalizada IS NOT NULL
     ORDER BY i.id DESC LIMIT 1`,
    proyectoId, tipo, numero
  );
}

// ---------- Reportes ----------

export async function guardarReporte(r: Omit<Reporte, 'id' | 'fecha'>) {
  const res = await db.runAsync(
    `INSERT INTO reportes (proyecto_id, inspeccion_id, tipo, codigo, nombre, archivo, fecha, total, cerrados, pendientes, anulados)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.proyecto_id, r.inspeccion_id, r.tipo, r.codigo, r.nombre, r.archivo, ahora(),
    r.total, r.cerrados, r.pendientes, r.anulados
  );
  return res.lastInsertRowId;
}

export function listarReportes(proyectoId: number) {
  return db.getAllAsync<Reporte>('SELECT * FROM reportes WHERE proyecto_id = ? ORDER BY fecha DESC', proyectoId);
}

export function obtenerReporte(id: number) {
  return db.getFirstAsync<Reporte>('SELECT * FROM reportes WHERE id = ?', id);
}
