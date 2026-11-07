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
