// Estructura general de la app: prepara la base de datos y define la barra superior.
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { colores } from '@/components/tema';
import { iniciarBaseDatos } from '@/lib/db';

export default function Layout() {
  const [lista, setLista] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    iniciarBaseDatos()
      .then(() => setLista(true))
      .catch((e) => setError(String(e)));
  }, []);

  if (!lista) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        {error ? (
          <Text style={{ fontSize: 18, color: colores.peligro }}>Error al abrir la base de datos: {error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colores.primario} />
        )}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colores.primario },
          headerTintColor: colores.primarioTexto,
          headerTitleStyle: { fontSize: 22, fontWeight: '800' },
          contentStyle: { backgroundColor: colores.fondo },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Proyectos' }} />
      </Stack>
    </>
  );
}
