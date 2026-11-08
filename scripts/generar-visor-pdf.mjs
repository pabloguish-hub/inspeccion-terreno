// Genera src/lib/pdfjs.ts con PDF.js (Mozilla, licencia Apache 2.0) como texto, para mostrar
// los reportes dentro de la app sin internet, tanto en Expo Go como en el APK.
// Uso (solo si se quiere cambiar la versión de PDF.js):
//   npm install --no-save pdfjs-dist@3.11.174 && node scripts/generar-visor-pdf.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const carpeta = join(dirname(require.resolve('pdfjs-dist/package.json')), 'legacy', 'build');
const raiz = fileURLToPath(new URL('..', import.meta.url));

// "</script" dentro del código cerraría la etiqueta <script> del visor antes de tiempo
const seguro = (archivo) => JSON.stringify(readFileSync(join(carpeta, archivo), 'utf8').replace(/<\/script/gi, '<\/script'));

writeFileSync(
  join(raiz, 'src', 'lib', 'pdfjs.ts'),
  `// ARCHIVO GENERADO por scripts/generar-visor-pdf.mjs. No editar a mano.\n` +
    `// PDF.js 3.11.174 (build legacy) de Mozilla, licencia Apache 2.0: https://github.com/mozilla/pdf.js\n` +
    `export const PDFJS: string = ${seguro('pdf.min.js')};\n` +
    `export const PDFJS_WORKER: string = ${seguro('pdf.worker.min.js')};\n`
);
console.log('Listo: src/lib/pdfjs.ts');
