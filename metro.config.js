// Configuración de Metro. Lo único extra es el soporte web de expo-sqlite (WebAssembly),
// que se usa para abrir la app en el navegador del PC (por ejemplo, para tomar capturas).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

// SQLite en web necesita SharedArrayBuffer, y el navegador solo lo habilita con estos encabezados
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

// Las librerías que arman el PDF solo se usan en el teléfono; en web se dejan vacías
const soloTelefono = new Set(['pdf-lib', '@pdf-lib/fontkit', 'react-native-webview']);
const resolverOriginal = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && soloTelefono.has(moduleName)) return { type: 'empty' };
  return (resolverOriginal ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
