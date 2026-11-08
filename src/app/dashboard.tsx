// Dashboard general: resumen de todos los proyectos y dónde quedan puntos por cerrar.
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { colorEstadoProyecto, colores, tamanos } from '@/components/tema';
import { BarraEstados, EstadoChip, Pantalla, ResumenEstados, Tarjeta, Text, TextoSuave, Titulo } from '@/components/ui';
import { ESTADOS_PROYECTO, avanceProyectos, porcentajeAvance, type AvanceProyecto } from '@/lib/db';

export default function DashboardGeneral() {
  const [proyectos, setProyectos] = useState<AvanceProyecto[]>([]);

  useFocusEffect(
    useCallback(() => {
      avanceProyectos().then(setProyectos);
    }, [])
  );

  const suma = (campo: keyof Pick<AvanceProyecto, 'total' | 'cerrados' | 'pendientes' | 'anulados' | 'porRevisar'>) =>
    proyectos.reduce((s, p) => s + p[campo], 0);
  const totales = {
    total: suma('total'),
    cerrados: suma('cerrados'),
    pendientes: suma('pendientes'),
    anulados: suma('anulados'),
    porRevisar: suma('porRevisar'),
  };
  // Primero los proyectos con más trabajo por cerrar
  const ordenados = [...proyectos].sort(
    (a, b) => b.pendientes + b.porRevisar - (a.pendientes + a.porRevisar) || porcentajeAvance(a) - porcentajeAvance(b)
  );

  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Dashboard general' }} />

      <Titulo>Proyectos ({proyectos.length})</Titulo>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
        {ESTADOS_PROYECTO.map((e) => {
          const c = colorEstadoProyecto(e);
          return (
            <View key={e} style={{ flex: 1, backgroundColor: c.fondo, borderRadius: tamanos.radio, paddingVertical: 8, alignItems: 'center',
              borderWidth: tamanos.linea, borderColor: colores.borde }}>
              <Text style={{ color: c.texto, fontSize: 28, fontWeight: '700' }}>{proyectos.filter((p) => p.estado === e).length}</Text>
              <Text style={{ color: c.texto, fontSize: 13, fontWeight: '700' }}>{e.toUpperCase()}</Text>
            </View>
          );
        })}
      </View>

      <Titulo>Puntos ({totales.total})</Titulo>
      <ResumenEstados {...totales} />
      <BarraEstados {...totales} alto={34} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10, marginBottom: 24 }}>
        <Text style={{ fontSize: 34, fontWeight: '700', color: colores.primario }}>{porcentajeAvance(totales)}%</Text>
        <Text style={{ fontSize: 17, color: colores.textoSuave, flex: 1 }}>de avance total (cerrados, sin contar los anulados)</Text>
      </View>

      <Titulo>Avance por proyecto</Titulo>
      <TextoSuave>Primero los proyectos con más puntos por cerrar.</TextoSuave>
      <View style={{ height: 8 }} />
      {proyectos.length === 0 ? <TextoSuave>Aún no hay proyectos.</TextoSuave> : null}
      {ordenados.map((p) => {
        const avance = porcentajeAvance(p);
        const porCerrar = p.pendientes + p.porRevisar;
        return (
          <Tarjeta key={p.id} onPress={() => router.push(`/proyecto/${p.id}`)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '700' }}>{p.nombre}</Text>
                <Text style={{ fontSize: 16, color: colores.textoSuave }}>{p.codigo}</Text>
              </View>
              <EstadoChip estado={p.estado} tipo="proyecto" />
            </View>

            {/* Barra de avance: % de puntos cerrados */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1, height: 18, borderRadius: tamanos.radio, backgroundColor: colores.grisClaro, overflow: 'hidden' }}>
                <View style={{ width: `${avance}%`, height: '100%', backgroundColor: colores.cerrado }} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colores.primario, width: 56, textAlign: 'right' }}>{avance}%</Text>
            </View>

            <Text style={{ fontSize: 17, marginTop: 6, fontWeight: '700', color: porCerrar ? colores.pendiente : colores.cerrado }}>
              {p.total === 0
                ? 'Sin puntos configurados'
                : porCerrar === 0
                  ? 'Sin puntos por cerrar'
                  : `${p.pendientes} pendiente(s)${p.porRevisar ? ` · ${p.porRevisar} por revisar` : ''}`}
            </Text>
          </Tarjeta>
        );
      })}
    </Pantalla>
  );
}
