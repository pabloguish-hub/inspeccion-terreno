// Manejo de archivos: fotos y PDFs guardados dentro del teléfono.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const carpeta = (nombre: string) => {
  const dir = new Directory(Paths.document, nombre);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

// Guardamos rutas relativas (ej: "fotos/123.jpg") y las convertimos a URI al usarlas.
export const uriDe = (rutaRelativa: string) => new File(Paths.document, rutaRelativa).uri;

export function borrarArchivos(rutas: (string | undefined)[]) {
  for (const r of rutas) {
    if (!r) continue;
    try {
      const f = new File(Paths.document, r);
      if (f.exists) f.delete();
    } catch {
      // Si no se puede borrar no es grave: solo ocupa espacio
    }
  }
}

/**
 * Abre la cámara nativa, toma la foto en máxima calidad, la recorta al centro en
 * formato cuadrado (1:1) y la guarda en la carpeta "fotos" de la app.
 * Devuelve la ruta relativa, o null si el usuario canceló.
 */
export async function tomarFotoCuadrada(): Promise<string | null> {
  const permiso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permiso.granted) {
    throw new Error('Debes permitir el uso de la cámara en los ajustes del teléfono.');
  }
  const resultado = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
    exif: false,
  });
  if (resultado.canceled || !resultado.assets?.length) return null;
  const origen = resultado.assets[0].uri;

  // Primero leemos la imagen para conocer su tamaño real (ya con la rotación correcta)
  const imagen = await ImageManipulator.manipulate(origen).renderAsync();
  const lado = Math.min(imagen.width, imagen.height);
  const recortada = await ImageManipulator.manipulate(imagen)
    .crop({
      originX: Math.floor((imagen.width - lado) / 2),
      originY: Math.floor((imagen.height - lado) / 2),
      width: lado,
      height: lado,
    })
    .renderAsync();
  const guardada = await recortada.saveAsync({ compress: 1, format: SaveFormat.JPEG });

  const nombre = `${Date.now()}.jpg`;
  const destino = new File(carpeta('fotos'), nombre);
  await new File(guardada.uri).move(destino);
  borrarTemporal(origen);
  return `fotos/${nombre}`;
}

function borrarTemporal(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // El archivo temporal lo limpia el sistema
  }
}

/** Versión reducida de una foto, en base64, para insertarla en el PDF sin que pese demasiado. */
export async function fotoParaPdf(rutaRelativa: string, ancho = 700): Promise<string> {
  const img = await ImageManipulator.manipulate(uriDe(rutaRelativa)).resize({ width: ancho }).renderAsync();
  const r = await img.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
  borrarTemporal(r.uri);
  return `data:image/jpeg;base64,${r.base64}`;
}

/** Nombre de archivo seguro: "Inspección PLANTA 01 07-11-2026" → "Inspeccion_PLANTA_01_07-11-2026" */
export function nombreArchivoSeguro(texto: string) {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita tildes
      .replace(/ñ/g, 'n')
      .replace(/Ñ/g, 'N')
      .replace(/[^a-zA-Z0-9 _-]/g, '') // quita caracteres especiales
      .trim()
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 80) || 'reporte'
  );
}

/**
 * Escribe el PDF (recibido en base64) en la carpeta "reportes" de la app.
 * No se mueve ni copia el archivo temporal de expo-print porque está fuera de las
 * carpetas a las que la app tiene permiso (ver explicación en pdf.ts).
 */
export async function guardarPdf(pdfBase64: string, nombreReporte: string): Promise<string> {
  const dir = carpeta('reportes');
  const base = nombreArchivoSeguro(nombreReporte);
  // Si ya existe un reporte con el mismo nombre, se agrega _2, _3...
  let nombre = `${base}.pdf`;
  for (let n = 2; new File(dir, nombre).exists; n++) nombre = `${base}_${n}.pdf`;
  const destino = new File(dir, nombre);
  destino.create();
  await destino.write(pdfBase64, { encoding: 'base64' });
  return `reportes/${nombre}`;
}
