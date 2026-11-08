// Reporte generado: resumen y botón para compartir el PDF (WhatsApp, correo, Drive, etc.).
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { colorEstado } from '@/components/tema';
import { Boton, Pantalla, TablaDatos, Text, Titulo } from '@/components/ui';
import { uriDe } from '@/lib/archivos';
import { obtenerReporte, type Reporte } from '@/lib/db';
import { fechaHora } from '@/lib/fechas';

export default function ReporteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reporte, setReporte] = useState<Reporte | null>(null);

  useEffect(() => {
    obtenerReporte(Number(id)).then(setReporte);
  }, [id]);

  async function compartir() {
    if (!reporte) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('No disponible', 'Este teléfono no permite compartir archivos.');
      return;
    }
    await Sharing.shareAsync(uriDe(reporte.archivo), {
      mimeType: 'application/pdf',
      dialogTitle: 'Compartir reporte',
      UTI: 'com.adobe.pdf',
    });
  }

  if (!reporte) return <Pantalla>{null}</Pantalla>;

  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Reporte' }} />
      <Titulo>{reporte.nombre}</Titulo>
      <TablaDatos
        filas={[
          ['Código', reporte.codigo ?? '—'],
          ['Generado', fechaHora(reporte.fecha)],
          ['Puntos', String(reporte.total)],
        ]}
      />
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
        {(
          [
            ['Cerrado', reporte.cerrados, 'CERRADOS'],
            ['Pendiente', reporte.pendientes, 'PENDIENTES'],
            ['Anulado', reporte.anulados, 'ANULADOS'],
          ] as const
        ).map(([estado, n, texto]) => {
          const c = colorEstado(estado);
          return (
            <View key={estado} style={{ flex: 1, backgroundColor: c.fondo, borderRadius: 3, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ color: c.texto, fontSize: 26, fontWeight: '700' }}>{n}</Text>
              <Text style={{ color: c.texto, fontSize: 13, fontWeight: '700' }}>{texto}</Text>
            </View>
          );
        })}
      </View>
      <Boton titulo="Compartir PDF" variante="exito" onPress={compartir} estilo={{ minHeight: 90 }} />
      <Boton
        titulo="Volver al proyecto"
        variante="secundario"
        onPress={() => router.dismissTo(`/proyecto/${reporte.proyecto_id}`)}
      />
    </Pantalla>
  );
}
