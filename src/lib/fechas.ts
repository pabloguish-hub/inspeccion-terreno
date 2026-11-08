// Fechas en formato chileno: 07-11-2026 14:35
const dos = (n: number) => String(n).padStart(2, '0');

export function fecha(iso: string) {
  const d = new Date(iso);
  return `${dos(d.getDate())}-${dos(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function fechaHora(iso: string) {
  const d = new Date(iso);
  return `${fecha(iso)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

// Las fechas elegidas por el usuario (inspección, próxima visita) se guardan como AAAA-MM-DD,
// sin hora, para que no cambien de día por la zona horaria.

/** Fecha de hoy como AAAA-MM-DD. */
export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** "2026-11-07" → "07-11-2026" */
export function fechaDia(dia: string | null | undefined) {
  if (!dia) return '';
  const [a, m, d] = dia.split('-');
  return `${d}-${m}-${a}`;
}

/** "07-11-2026" (también acepta / o .) → "2026-11-07", o null si no es una fecha válida. */
export function leerFecha(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!m) return null;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(a, mes - 1, d);
  if (f.getFullYear() !== a || f.getMonth() !== mes - 1 || f.getDate() !== d) return null;
  return `${a}-${dos(mes)}-${dos(d)}`;
}
