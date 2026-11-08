// Visor de PDF dentro de la app (navegador interno + PDF.js). Funciona en Expo Go y en el APK, sin internet.
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { htmlVisor } from '@/lib/visorHtml';
import { colores } from './tema';
import { Text } from './Texto';

export function VisorPdf({ uri }: { uri: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    new File(uri)
      .base64()
      .then((b64) => vigente && setHtml(htmlVisor(b64)))
      .catch((e) => vigente && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vigente = false;
    };
  }, [uri]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, color: colores.peligro }}>No se pudo abrir el archivo: {error}</Text>
      </View>
    );
  }
  if (!html) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }
  return (
    <WebView
      source={{ html }}
      originWhitelist={['*']}
      style={{ flex: 1, backgroundColor: colores.grisClaro }}
      setBuiltInZoomControls
      setDisplayZoomControls={false}
      onMessage={(e) => {
        if (e.nativeEvent.data.startsWith('error:')) setError(e.nativeEvent.data.slice(6));
      }}
    />
  );
}
