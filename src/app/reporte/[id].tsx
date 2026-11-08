// Reporte: el PDF se ve dentro de la app, con botón para compartirlo (WhatsApp, correo, Drive, etc.).
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colorEstado, colores, tamanos } from '@/components/tema';
import { Boton, Text } from '@/components/ui';
import { VisorPdf } from '@/components/VisorPdf';
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

  if (!reporte) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colores.fondo }} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: reporte.codigo ?? 'Reporte' }} />

      {/* Datos del reporte en una franja compacta, para dejar espacio al PDF */}
      <View style={{ paddingHorizontal: tamanos.espacio, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colores.borde }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colores.primario }}>{reporte.nombre}</Text>
        <Text style={{ fontSize: 16, color: colores.textoSuave }}>
          {reporte.codigo ? `${reporte.codigo} · ` : ''}
          {fechaHora(reporte.fecha)} · {reporte.total} puntos
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          {(
            [
              ['Cerrado', reporte.cerrados],
              ['Pendiente', reporte.pendientes],
              ['Anulado', reporte.anulados],
            ] as const
          ).map(([estado, n]) => {
            const c = colorEstado(estado);
            return (
              <View key={estado} style={{ flex: 1, backgroundColor: c.fondo, borderRadius: 3, paddingVertical: 4, alignItems: 'center' }}>
                <Text style={{ color: c.texto, fontSize: 15, fontWeight: '700' }}>
                  {n} {estado.toUpperCase()}
                  {n === 1 ? '' : 'S'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <VisorPdf uri={uriDe(reporte.archivo)} />

      <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colores.borde }}>
        <Boton titulo="Compartir PDF" variante="exito" onPress={compartir} estilo={{ flex: 3, marginBottom: 0 }} />
        <Boton
          titulo="Proyecto"
          variante="secundario"
          onPress={() => router.dismissTo(`/proyecto/${reporte.proyecto_id}`)}
          estilo={{ flex: 2, marginBottom: 0 }}
        />
      </View>
    </SafeAreaView>
  );
}
