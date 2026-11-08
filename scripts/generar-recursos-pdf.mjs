// Genera src/lib/recursosPdf.ts: logo y fuente Carlito (reducida a los caracteres
// del español) en base64, para insertarlos en el PDF sin depender de archivos externos.
// Uso (no se ejecuta al compilar; solo si cambia el logo o la fuente):
//   npx -p subset-font@2 -p jimp@1.6.1 node scripts/generar-recursos-pdf.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const subsetFont = require('subset-font');
const { Jimp } = require('jimp');

const raiz = fileURLToPath(new URL('..', import.meta.url));
const fuentes = `${raiz}node_modules/@expo-google-fonts/carlito`;

// ASCII + Latin-1 (á é í ó ú ñ ü ° ¿ ¡ etc.) + signos tipográficos comunes
let caracteres = '';
for (let c = 0x20; c <= 0x7e; c++) caracteres += String.fromCharCode(c);
for (let c = 0xa0; c <= 0xff; c++) caracteres += String.fromCharCode(c);
caracteres += '—–‘’“”•…€№';

const reducir = async (archivo) =>
  (await subsetFont(readFileSync(archivo), caracteres, { targetFormat: 'truetype' })).toString('base64');

const regular = await reducir(`${fuentes}/400Regular/Carlito_400Regular.ttf`);
const negrita = await reducir(`${fuentes}/700Bold/Carlito_700Bold.ttf`);
const logo = await Jimp.read(`${raiz}assets/teck/logo.png`);
const logoB64 = (await logo.resize({ w: 600 }).getBase64('image/png')).split(',')[1];

writeFileSync(
  `${raiz}src/lib/recursosPdf.ts`,
  `// ARCHIVO GENERADO por scripts/generar-recursos-pdf.mjs. No editar a mano.\n` +
    `// Logo Teck CDA y fuente Carlito (licencia SIL OFL) en base64 para los reportes PDF.\n` +
    `export const LOGO_PNG = '${logoB64}';\n` +
    `export const CARLITO_REGULAR = '${regular}';\n` +
    `export const CARLITO_NEGRITA = '${negrita}';\n`
);
console.log('KB:', { logo: logoB64.length >> 10, regular: regular.length >> 10, negrita: negrita.length >> 10 });
