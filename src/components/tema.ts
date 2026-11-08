// Identidad visual Teck CDA. Todo el estilo de la app sale de este archivo:
// las pantallas nuevas solo deben usar estos colores, tamaños y fuentes.
// Botones y letras grandes, alto contraste: la app se usa con guantes y a pleno sol.

export const colores = {
  // Marca
  primario: '#000F3F', // azul Teck: barra superior, títulos, botones principales
  primarioTexto: '#FFFFFF',
  grisClaro: '#EDEDED', // fondo de etiquetas, tablas y tarjetas destacadas

  // Textos y fondos
  fondo: '#FFFFFF',
  tarjeta: '#FFFFFF',
  texto: '#1B1B1B',
  textoSuave: '#595959',
  borde: '#BFBFBF',

  // Estados de los puntos (mismos colores de los reportes Word)
  cerrado: '#00B050',
  pendiente: '#C00000',
  anulado: '#FFC000',
  sinInspeccion: '#595959',

  peligro: '#C00000',
};

export const tamanos = {
  boton: 68, // alto mínimo de botones
  texto: 20,
  titulo: 26,
  chico: 17,
  radio: 3, // esquinas casi rectas, como los documentos
  linea: 1, // bordes finos
  espacio: 16,
};

// Fuente Carlito: gratuita y con las mismas medidas que Calibri (la de los reportes)
export const fuentes = {
  normal: 'Carlito_400Regular',
  negrita: 'Carlito_700Bold',
};

/** Colores de fondo y texto para mostrar un estado de punto o de proyecto. */
export function colorEstado(estado: string | null | undefined): { fondo: string; texto: string } {
  switch (estado) {
    case 'Cerrado':
      return { fondo: colores.cerrado, texto: '#FFFFFF' };
    case 'Pendiente':
      return { fondo: colores.pendiente, texto: '#FFFFFF' };
    case 'Anulado':
      return { fondo: colores.anulado, texto: colores.primario }; // texto azul: se lee mejor al sol
    default:
      return { fondo: colores.sinInspeccion, texto: '#FFFFFF' };
  }
}

/** Los estados del proyecto son administrativos: se muestran sobrios, en gris y azul. */
export function colorEstadoProyecto(estado: string): { fondo: string; texto: string } {
  return estado === 'Cerrado'
    ? { fondo: colores.primario, texto: '#FFFFFF' }
    : { fondo: colores.grisClaro, texto: colores.primario };
}
