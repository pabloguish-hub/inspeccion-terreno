// Colores de alto contraste para usar al sol, y tamaños grandes para usar con guantes.
export const colores = {
  fondo: '#F2F4F7',
  tarjeta: '#FFFFFF',
  texto: '#111111',
  textoSuave: '#4A4A4A',
  borde: '#9AA3AE',
  primario: '#0B3D91',
  primarioTexto: '#FFFFFF',
  cerrado: '#1B7F3B',
  pendiente: '#E06C00',
  sinInspeccion: '#5F6B7A',
  peligro: '#B3261E',
  enEjecucion: '#0B6FB8',
};

export const tamanos = {
  boton: 68, // alto mínimo de botones
  texto: 20,
  titulo: 26,
  chico: 17,
  radio: 12,
  espacio: 16,
};

export function colorEstado(estado: string | null | undefined) {
  switch (estado) {
    case 'Cerrado':
      return colores.cerrado;
    case 'Pendiente':
      return colores.pendiente;
    case 'En ejecución':
      return colores.enEjecucion;
    default:
      return colores.sinInspeccion;
  }
}
