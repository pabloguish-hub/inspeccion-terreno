// Versión web del visor (solo para el modo demostración en el PC). Usa la misma página de
// PDF.js que el teléfono, así las capturas muestran exactamente lo que ve el usuario.
import { useEffect, useState } from 'react';
import { htmlVisor } from '@/lib/visorHtml';

export function VisorPdf({ uri }: { uri: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    fetch(uri)
      .then((r) => r.arrayBuffer())
      .then((bytes) => {
        let binario = '';
        new Uint8Array(bytes).forEach((b) => (binario += String.fromCharCode(b)));
        setHtml(htmlVisor(btoa(binario)));
      })
      .catch(() => setHtml('<p style="font-family:sans-serif;padding:20px">No se pudo abrir el archivo.</p>'));
  }, [uri]);
  if (!html) return null;
  return <iframe srcDoc={html} title="Reporte" style={{ flex: 1, border: 'none', width: '100%' }} />;
}
