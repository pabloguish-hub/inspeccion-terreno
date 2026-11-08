// Reporte generado: resumen y botón para compartir el PDF (WhatsApp, correo, Drive, etc.).
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { colores } from '@/components/tema';
import { Boton, Pantalla, Tarjeta, Titulo, Text } from '@/components/ui';
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
      <Tarjeta>
        <Titulo>{reporte.nombre}</Titulo>
        <Text style={{ fontSize: 18, color: colores.textoSuave }}>Generado el {fechaHora(reporte.fecha)}</Text>
        <Text style={{ fontSize: 20, marginTop: 10 }}>Puntos inspeccionados: {reporte.total}</Text>
        <Text style={{ fontSize: 20, color: colores.cerrado, fontWeight: '800' }}>Cerrados: {reporte.cerrados}</Text>
        <Text style={{ fontSize: 20, color: colores.pendiente, fontWeight: '800' }}>Pendientes: {reporte.pendientes}</Text>
      </Tarjeta>
      <Boton titulo="Compartir PDF" variante="exito" onPress={compartir} estilo={{ minHeight: 90 }} />
      <Boton
        titulo="Volver al proyecto"
        variante="secundario"
        onPress={() => router.dismissTo(`/proyecto/${reporte.proyecto_id}`)}
      />
    </Pantalla>
  );
}
