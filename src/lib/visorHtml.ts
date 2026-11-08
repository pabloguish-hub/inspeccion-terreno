// Página HTML que muestra un PDF con PDF.js dentro del navegador interno de la app.
// Todo va incluido en la página (PDF.js y el propio PDF), así funciona sin internet.
import { PDFJS, PDFJS_WORKER } from './pdfjs';

/**
 * Crea la página del visor. Cada hoja del PDF se dibuja como imagen, una debajo de otra,
 * y se puede ampliar con dos dedos. Avisa a la app con postMessage: "listo:N" o "error:...".
 */
export function htmlVisor(pdfBase64: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
<style>
  html, body { margin: 0; background: #EDEDED; font-family: sans-serif; }
  #estado { padding: 40px 20px; text-align: center; color: #000F3F; font-size: 18px; font-weight: bold; }
  #paginas { padding: 0 8px; }
  canvas { display: block; width: 100%; height: auto; margin: 8px 0; background: #FFFFFF;
           box-shadow: 0 1px 3px rgba(0,0,0,.25); }
</style></head>
<body>
<div id="estado">Abriendo reporte…</div>
<div id="paginas"></div>
<script>${PDFJS_WORKER}</script>
<script>${PDFJS}</script>
<script>
  function avisar(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m); }
  (async function () {
    try {
      // El "worker" de PDF.js ya está cargado en esta página (pdfjsWorker): no se usa un hilo aparte
      var binario = atob(${JSON.stringify(pdfBase64)});
      var datos = new Uint8Array(binario.length);
      for (var i = 0; i < binario.length; i++) datos[i] = binario.charCodeAt(i);
      var pdf = await pdfjsLib.getDocument({ data: datos, isEvalSupported: false }).promise;
      var contenedor = document.getElementById('paginas');
      // Ancho útil real de la página (sin barras de desplazamiento ni márgenes)
      var ancho = contenedor.clientWidth - 16;
      // Más resolución que la pantalla para que se lea bien al ampliar, con un tope para no agotar memoria
      var nitidez = Math.min((window.devicePixelRatio || 1) * 1.5, 3);
      for (var n = 1; n <= pdf.numPages; n++) {
        var pagina = await pdf.getPage(n);
        var escala = ancho / pagina.getViewport({ scale: 1 }).width;
        var vista = pagina.getViewport({ scale: escala * nitidez });
        var lienzo = document.createElement('canvas');
        lienzo.width = Math.floor(vista.width);
        lienzo.height = Math.floor(vista.height);
        contenedor.appendChild(lienzo);
        await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: vista }).promise;
        if (n === 1) document.getElementById('estado').style.display = 'none';
      }
      avisar('listo:' + pdf.numPages);
    } catch (e) {
      document.getElementById('estado').textContent = 'No se pudo mostrar el reporte.';
      avisar('error:' + (e && e.message ? e.message : e));
    }
  })();
</script>
</body></html>`;
}
