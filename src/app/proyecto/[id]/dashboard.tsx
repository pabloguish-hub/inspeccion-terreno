// Dashboard del proyecto: totales de puntos por estado y avance de cada inspección.
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { colores } from '@/components/tema';
import { BarraEstados, EstadoChip, Pantalla, ResumenEstados, Tarjeta, Text, TextoSuave, Titulo } from '@/components/ui';
import {
  inspeccionesDelProyecto,
  listarReportes,
  nombreInspeccion,
  obtenerProyecto,
  porcentajeAvance,
  resumenPuntos,
  type Proyecto,
  type ResumenInspeccion,
} from '@/lib/db';
import { fechaDia } from '@/lib/fechas';

export default function DashboardProyecto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proyectoId = Number(id);
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [resumen, setResumen] = useState<Awaited<ReturnType<typeof resumenPuntos>> | null>(null);
  const [inspecciones, setInspecciones] = useState<ResumenInspeccion[]>([]);
  const [reportePorInspeccion, setReportePorInspeccion] = useState<Record<number, number>>({});

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setProyecto(await obtenerProyecto(proyectoId));
        setResumen(await resumenPuntos(proyectoId));
        setInspecciones(await inspeccionesDelProyecto(proyectoId));
        const reportes = await listarReportes(proyectoId);
        // El reporte más reciente de cada inspección (la lista viene del más nuevo al más antiguo)
        const mapa: Record<number, number> = {};
        for (const r of reportes) mapa[r.inspeccion_id] ??= r.id;
        setReportePorInspeccion(mapa);
      })();
    }, [proyectoId])
  );

  if (!proyecto || !resumen) return <Pantalla>{null}</Pantalla>;
  const avance = porcentajeAvance(resumen);

  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Dashboard del proyecto' }} />
      <Text style={{ fontSize: 17, color: colores.textoSuave }}>{proyecto.codigo}</Text>
      <Titulo>{proyecto.nombre}</Titulo>

      <Text style={{ fontSize: 20, fontWeight: '700', color: colores.primario, marginBottom: 8 }}>
        Puntos del proyecto ({resumen.total})
      </Text>
      <ResumenEstados {...resumen} />
      <BarraEstados {...resumen} alto={34} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10, marginBottom: 24 }}>
        <Text style={{ fontSize: 34, fontWeight: '700', color: colores.primario }}>{avance}%</Text>
        <Text style={{ fontSize: 17, color: colores.textoSuave, flex: 1 }}>de avance (cerrados, sin contar los anulados)</Text>
      </View>

      <Titulo>Inspecciones</Titulo>
      {inspecciones.length === 0 ? <TextoSuave>Todavía no hay inspecciones.</TextoSuave> : null}
      {inspecciones.map((i) => {
        const reporteId = reportePorInspeccion[i.id];
        return (
          <Tarjeta key={i.id} onPress={reporteId ? () => router.push(`/reporte/${reporteId}`) : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colores.primario, flex: 1 }}>
                {i.tipo === 'Inspección' ? 'Inspección' : `RI N° ${i.numero}`}
              </Text>
              <Text style={{ fontSize: 18, color: colores.textoSuave }}>{fechaDia(i.fecha)}</Text>
            </View>
            <Text style={{ fontSize: 16, color: colores.textoSuave, marginBottom: 8 }}>
              {nombreInspeccion(i.tipo, i.numero)} · {i.total} punto(s) inspeccionado(s)
            </Text>
            {!i.finalizada ? (
              <View style={{ marginBottom: 8 }}>
                <EstadoChip estado="En curso" tipo="proyecto" />
              </View>
            ) : null}
            <BarraEstados cerrados={i.cerrados} pendientes={i.pendientes} anulados={i.anulados} />
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colores.cerrado }}>{i.cerrados} cerrados</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colores.primario }}>{i.anulados} anulados</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colores.pendiente }}>{i.pendientes} pendientes</Text>
            </View>
            {reporteId ? <Text style={{ fontSize: 16, color: colores.primario, fontWeight: '700', marginTop: 8 }}>Ver reporte ›</Text> : null}
          </Tarjeta>
        );
      })}
    </Pantalla>
  );
}
