// Datos de demostración para abrir la app en el navegador del PC (manual, capturas, pruebas).
// Solo se cargan en web, en modo desarrollo y con ?demo en la dirección. Nunca en el teléfono.
import { db } from './db';

const hoy = (dias = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const hora = (dia: string, h: string) => `${dia}T${h}:00.000Z`;

export async function cargarDatosDemo() {
  const hay = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM proyectos');
  if (hay && hay.n > 0) return;

  const d0 = hoy(-7); // primera inspección
  const d1 = hoy(-3); // re-inspección N° 1
  const d2 = hoy(0); // re-inspección N° 2, en curso

  await db.execAsync(`
    INSERT INTO ajustes VALUES ('inspector_nombre', 'Pablo Muñoz'), ('inspector_cargo', 'ITO Estructural');

    INSERT INTO proyectos (id, nombre, area, codigo, revision, contratista, contrato, estado, creado) VALUES
      (1, 'Montaje de soportes de piping, Línea de agua Eje 8', 'PMO — Estructuras / Piping', 'CDA-ITO-015', '0',
         'Montajes Norte SpA', 'OT-4471', 'En ejecución', '${hora(hoy(-9), '09:00')}'),
      (2, 'Reparación de revestimientos chancador primario', 'Planta concentradora', 'CDA-ITO-021', '0',
         'Servicios Mineros Andes Ltda.', 'CT-2026-118', 'Pendiente', '${hora(hoy(-2), '10:00')}'),
      (3, 'Pasarela de acceso espesador N° 2', 'Planta concentradora — Espesadores', 'CDA-ITO-009', '1',
         'Estructuras del Norte S.A.', 'OT-4390', 'Cerrado', '${hora(hoy(-30), '08:00')}');

    INSERT INTO alcance (proyecto_id, tipo, texto, orden) VALUES
      (1, 'Incluido', '6 soportes tipo S-2 (ejes 8A a 8F)', 0),
      (1, 'Incluido', '4 uniones soldadas a tope y pernos de anclaje', 1),
      (1, 'Excluido', 'Prueba hidrostática de la línea', 2),
      (1, 'Excluido', 'Revestimiento y pintura', 3);

    INSERT INTO documentos (id, proyecto_id, codigo, titulo, rev, orden) VALUES
      (1, 1, 'CDA-P-1208', 'Plano isométrico línea de agua — Eje 8', 'B', 0),
      (2, 1, 'CDA-ET-015', 'Especificación técnica de piping', '1', 1),
      (3, 1, 'ASME B31.3', 'Process Piping', '2022', 2),
      (4, 1, 'AWS D1.1', 'Structural Welding Code — Steel', '2020', 3);

    INSERT INTO sectores (id, proyecto_id, nombre) VALUES
      (1, 1, 'Eje 8'), (2, 1, 'Eje 9'),
      (3, 2, 'Chancador — lado norte'), (4, 2, 'Chancador — lado sur'),
      (5, 3, 'Pasarela');

    INSERT INTO puntos (id, sector_id, numero, nombre, estado) VALUES
      (1, 1, 1, 'Ubicación y elevación de soportes', 'Cerrado'),
      (2, 1, 2, 'Torque de pernos de anclaje', 'Cerrado'),
      (3, 1, 3, 'Inspección visual de soldaduras', 'Pendiente'),
      (4, 1, 4, 'Soporte 8F — verificación de placa base', 'Anulado'),
      (5, 2, 5, 'Alineamiento de línea en eje 9', 'Cerrado'),
      (6, 2, 6, 'Apriete de abrazaderas', 'Cerrado'),
      (7, 3, 1, 'Estado de pernos de fijación de revestimientos', 'Sin inspección'),
      (8, 3, 2, 'Desgaste de placas laterales', 'Sin inspección'),
      (9, 4, 3, 'Sello de la tolva de descarga', 'Sin inspección'),
      (10, 4, 4, 'Limpieza y retiro de material suelto', 'Sin inspección'),
      (11, 5, 1, 'Barandas y rodapiés', 'Cerrado'),
      (12, 5, 2, 'Parrillas de piso y fijaciones', 'Cerrado'),
      (13, 5, 3, 'Uniones apernadas de columnas', 'Cerrado');

    INSERT INTO inspecciones (id, proyecto_id, tipo, numero, fecha, sector_area, personal, iniciada, finalizada, proxima_fecha, proxima_responsable) VALUES
      (1, 1, 'Inspección', 0, '${d0}', 'Sector planta — Eje 8', 'Juan Pérez — Supervisor contratista; Pablo Muñoz — ITO Teck',
         '${hora(d0, '13:05')}', '${hora(d0, '15:40')}', '${d1}', 'Montajes Norte — Supervisor / QA-QC'),
      (2, 1, 'Re-Inspección', 1, '${d1}', 'Sector planta — Eje 8', 'Juan Pérez — Supervisor contratista; Pablo Muñoz — ITO Teck',
         '${hora(d1, '14:00')}', '${hora(d1, '15:10')}', '${d2}', 'Montajes Norte — Supervisor / QA-QC'),
      (3, 1, 'Re-Inspección', 2, '${d2}', 'Sector planta — Eje 8', 'Juan Pérez — Supervisor contratista; Pablo Muñoz — ITO Teck',
         '${hora(d2, '10:20')}', NULL, NULL, NULL),
      (4, 3, 'Inspección', 0, '${hoy(-25)}', 'Espesador N° 2', 'Marcela Rojas — Supervisora contratista; Pablo Muñoz — ITO Teck',
         '${hora(hoy(-25), '09:00')}', '${hora(hoy(-25), '11:30')}', NULL, NULL);

    INSERT INTO inspeccion_puntos (id, inspeccion_id, punto_id, fecha, observacion, estado, fecha_anterior, doc_detalle) VALUES
      (1, 1, 1, '${hora(d0, '13:20')}', 'Soportes 8A a 8F instalados según plano CDA-P-1208. Sin desviaciones.', 'Cerrado', NULL, NULL),
      (2, 1, 2, '${hora(d0, '13:45')}', 'Soporte 8C: 2 de 8 pernos con torque inferior al especificado.', 'Pendiente', NULL, 'torque de anclajes'),
      (3, 1, 3, '${hora(d0, '14:10')}', 'Unión W-03 con socavación fuera de lo admisible. Requiere reparación.', 'Pendiente', NULL, 'Tabla 341.3.2 — Criterios de aceptación de soldaduras'),
      (4, 1, 4, '${hora(d0, '14:30')}', 'Soporte eliminado por cambio de ingeniería DCI-022.', 'Anulado', NULL, NULL),
      (5, 1, 5, '${hora(d0, '15:00')}', 'Línea alineada dentro de tolerancia.', 'Cerrado', NULL, NULL),
      (6, 1, 6, '${hora(d0, '15:20')}', 'Abrazaderas apretadas y con golilla de presión.', 'Cerrado', NULL, NULL),
      (7, 2, 2, '${hora(d1, '14:15')}', 'Se verificó re-torque de los 8 pernos. Valores dentro de lo especificado. Contratista entregó registro de torque.', 'Cerrado', '${hora(d0, '13:45')}', NULL),
      (8, 2, 3, '${hora(d1, '14:40')}', 'Reparación aún no ejecutada. Contratista indica que se realizará esta semana.', 'Pendiente', '${hora(d0, '14:10')}', 'Tabla 341.3.2 — Criterios de aceptación de soldaduras'),
      (9, 3, 3, '${hora(d2, '10:30')}', NULL, NULL, '${hora(d1, '14:40')}', NULL),
      (10, 4, 11, '${hora(hoy(-25), '09:20')}', 'Barandas completas, altura 1,10 m. Rodapiés instalados.', 'Cerrado', NULL, NULL),
      (11, 4, 12, '${hora(hoy(-25), '10:00')}', 'Parrillas fijadas con grapas en los 4 puntos.', 'Cerrado', NULL, NULL),
      (12, 4, 13, '${hora(hoy(-25), '10:40')}', 'Pernos con marca de torque. Conforme.', 'Cerrado', NULL, NULL);

    INSERT INTO inspeccion_punto_docs (inspeccion_punto_id, documento_id) VALUES (2, 2), (2, 1), (3, 3), (8, 3);

    INSERT INTO fotos (inspeccion_punto_id, archivo, pie, fecha) VALUES
      (1, 'demo/foto1.png', 'Soportes ejes 8A–8C', '${hora(d0, '13:18')}'),
      (2, 'demo/foto2.png', 'Pernos soporte 8C', '${hora(d0, '13:40')}'),
      (2, 'demo/foto3.png', 'Lectura torquímetro', '${hora(d0, '13:42')}'),
      (3, 'demo/foto4.png', 'Unión W-03', '${hora(d0, '14:05')}'),
      (4, 'demo/foto5.png', 'Ubicación soporte 8F', '${hora(d0, '14:28')}'),
      (7, 'demo/foto2.png', 'Pernos soporte 8C re-torqueados', '${hora(d1, '14:12')}'),
      (8, 'demo/foto4.png', 'Unión W-03 sin reparar', '${hora(d1, '14:36')}'),
      (9, 'demo/foto4.png', 'Unión W-03 reparada', '${hora(d2, '10:28')}'),
      (9, 'demo/foto1.png', 'Inspección visual de soldaduras', '${hora(d2, '10:29')}');

    INSERT INTO reportes (proyecto_id, inspeccion_id, tipo, codigo, nombre, archivo, fecha, total, cerrados, pendientes, anulados) VALUES
      (1, 1, 'Inspección', 'CDA-ITO-015', 'Reporte de Inspección ITO', 'demo/CDA-ITO-015.pdf', '${hora(d0, '15:41')}', 6, 3, 2, 1),
      (1, 2, 'Re-Inspección', 'CDA-ITO-015-RI1', 'Re-Inspección N° 1', 'demo/CDA-ITO-015-RI1.pdf', '${hora(d1, '15:11')}', 2, 1, 1, 0),
      (3, 4, 'Inspección', 'CDA-ITO-009', 'Reporte de Inspección ITO', 'demo/CDA-ITO-015.pdf', '${hora(hoy(-25), '11:31')}', 3, 3, 0, 0);
  `);
}
