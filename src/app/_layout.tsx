// Estructura general de la app: carga la fuente, prepara la base de datos y define la barra superior.
import { Carlito_400Regular, Carlito_700Bold, useFonts } from '@expo-google-fonts/carlito';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { colores, fuentes } from '@/components/tema';
import { BotonBarra, LogoBarra } from '@/components/ui';
import { iniciarBaseDatos } from '@/lib/db';

// La pantalla de inicio (logo Teck sobre azul) se mantiene hasta que todo esté listo
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [fuentesListas, errorFuentes] = useFonts({ Carlito_400Regular, Carlito_700Bold });
  const [dbLista, setDbLista] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    iniciarBaseDatos()
      .then(async () => {
        // Modo demostración: solo en el navegador del PC, en desarrollo y con ?demo en la dirección
        if (Platform.OS === 'web' && __DEV__ && window.location.search.includes('demo')) {
          await (await import('@/lib/demo')).cargarDatosDemo();
        }
      })
      .then(() => setDbLista(true))
      .catch((e) => setError(String(e)));
  }, []);

  // Si la fuente no carga, la app sigue con la fuente del sistema
  const listo = dbLista && (fuentesListas || !!errorFuentes);
  useEffect(() => {
    if (listo || error) SplashScreen.hideAsync();
  }, [listo, error]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colores.fondo }}>
        <Text style={{ fontSize: 18, color: colores.peligro }}>Error al abrir la base de datos: {error}</Text>
      </View>
    );
  }
  if (!listo) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colores.primario },
          headerTintColor: colores.primarioTexto,
          headerTitleStyle: { fontSize: 22, fontFamily: fuentes.negrita },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colores.fondo },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Proyectos',
            headerTitle: () => <LogoBarra />,
            headerRight: () => (
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <BotonBarra icono="chart-bar" etiqueta="Dashboard general" onPress={() => router.push('/dashboard')} />
                <BotonBarra icono="cog" etiqueta="Ajustes" onPress={() => router.push('/ajustes')} />
              </View>
            ),
          }}
        />
      </Stack>
    </>
  );
}
