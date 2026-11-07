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

/** Mueve el PDF generado (temporal) a la carpeta "reportes" con un nombre legible. */
export async function guardarPdf(uriTemporal: string, nombreReporte: string): Promise<string> {
  const limpio =
    nombreReporte
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'reporte';
  const nombre = `${limpio}_${Date.now()}.pdf`;
  await new File(uriTemporal).move(new File(carpeta('reportes'), nombre));
  return `reportes/${nombre}`;
}
