// Lista de puntos pendientes del proyecto, con acceso directo a reinspeccionarlos.
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { colores } from '@/components/tema';
import { Boton, Pantalla, Tarjeta, TextoSuave, estilos, Text } from '@/components/ui';
import { inspeccionEnCurso, listarPuntosPendientes, type Inspeccion } from '@/lib/db';
import { fechaHora } from '@/lib/fechas';

type Pendiente = Awaited<ReturnType<typeof listarPuntosPendientes>>[number];

export default function Pendientes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proyectoId = Number(id);
  const [lista, setLista] = useState<Pendiente[]>([]);
  const [enCurso, setEnCurso] = useState<Inspeccion | null>(null);

  useFocusEffect(
    useCallback(() => {
      listarPuntosPendientes(proyectoId).then(setLista);
      inspeccionEnCurso(proyectoId).then(setEnCurso);
    }, [proyectoId])
  );

  function reinspeccionar(puntoId: number) {
    // Si ya hay una inspección en curso, el punto se agrega a esa misma inspección
    router.push({
      pathname: '/proyecto/[id]/inspeccion',
      params: enCurso
        ? { id: proyectoId, puntoId, inspeccionId: enCurso.id }
        : { id: proyectoId, puntoId },
    });
  }

  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Puntos pendientes' }} />
      {enCurso ? (
        <TextoSuave>Hay una inspección en curso: la reinspección se agregará a ella.</TextoSuave>
      ) : null}
      {lista.length === 0 ? <TextoSuave>No hay puntos pendientes. ¡Todo al día!</TextoSuave> : null}
      {lista.map((p) => (
        <Tarjeta key={p.id}>
          <Text style={{ fontSize: 17, color: colores.textoSuave }}>Sector: {p.sector_nombre}</Text>
          <Text style={estilos.opcionTexto}>{p.nombre}</Text>
          {p.ultima_fecha ? (
            <Text style={{ fontSize: 17, color: colores.pendiente, fontWeight: '700', marginTop: 4 }}>
              Pendiente desde {fechaHora(p.ultima_fecha)}
            </Text>
          ) : null}
          {p.ultima_obs ? <Text style={{ fontSize: 17, marginTop: 4 }}>Obs.: {p.ultima_obs}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Boton titulo="Reinspeccionar" variante="alerta" estilo={{ flex: 3, marginBottom: 0 }} onPress={() => reinspeccionar(p.id)} />
            <Boton
              titulo="Historial"
              variante="secundario"
              estilo={{ flex: 2, marginBottom: 0 }}
              onPress={() => router.push(`/punto/${p.id}`)}
            />
          </View>
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
