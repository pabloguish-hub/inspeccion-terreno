# Inspección Terreno

App Android para generar reportes de inspección en terreno. Funciona **sin internet**:
todos los datos y fotos quedan guardados en el teléfono.

Hecha con Expo SDK 58 (React Native + TypeScript) y Expo Router.

## Probar en el celular (Expo Go)

1. Instala **Expo Go** desde Play Store.
2. En esta carpeta ejecuta:

   ```bash
   npx expo start
   ```

3. Escanea el código QR con la app Expo Go (celular y PC en la misma red Wi-Fi).
   Si no conecta, usa `npx expo start --tunnel`.

## Generar el APK instalable

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android
```

Al terminar, EAS entrega un enlace para descargar el `.apk` e instalarlo en el teléfono.

## Estructura

- `src/app/` – pantallas (cada archivo es una pantalla)
- `src/components/` – botones, menús desplegables y colores
- `src/lib/db.ts` – base de datos local (SQLite)
- `src/lib/archivos.ts` – fotos (cámara, recorte 1:1) y archivos PDF
- `src/lib/pdf.ts` – generación del reporte PDF
