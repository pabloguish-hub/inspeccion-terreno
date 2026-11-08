// Puntos pendientes del proyecto (y puntos nuevos aún sin revisar), con acceso a la Re-Inspección.
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { colores } from '@/components/tema';
import { Boton, EstadoChip, Pantalla, Tarjeta, Text, TextoSuave } from '@/components/ui';
import {
  inspeccionEnCurso,
  listarPuntosPendientes,
  nombreInspeccion,
  siguienteInspeccion,
  type Inspeccion,
  type PuntoPendiente,
  type TipoInspeccion,
} from '@/lib/db';
import { fechaHora } from '@/lib/fechas';

export default function Pendientes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proyectoId = Number(id);
  const [lista, setLista] = useState<PuntoPendiente[]>([]);
  const [enCurso, setEnCurso] = useState<Inspeccion | null>(null);
  const [siguiente, setSiguiente] = useState<{ tipo: TipoInspeccion; numero: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      listarPuntosPendientes(proyectoId).then(setLista);
      inspeccionEnCurso(proyectoId).then(setEnCurso);
      siguienteInspeccion(proyectoId).then(setSiguiente);
    }, [proyectoId])
  );

  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Puntos pendientes' }} />
      {lista.length === 0 ? <TextoSuave>No hay puntos pendientes.</TextoSuave> : null}

      {lista.length > 0 && siguiente?.tipo === 'Re-Inspección' ? (
        enCurso ? (
          <Boton
            titulo={`Continuar ${nombreInspeccion(enCurso.tipo, enCurso.numero)}`}
            variante="exito"
            onPress={() => router.push({ pathname: '/proyecto/[id]/inspeccion', params: { id: proyectoId, inspeccionId: enCurso.id } })}
          />
        ) : (
          <Boton
            titulo={`Nueva Re-Inspección N° ${siguiente.numero}`}
            onPress={() => router.push({ pathname: '/proyecto/[id]/inspeccion', params: { id: proyectoId } })}
          />
        )
      ) : null}

      {lista.map((p) => (
        <Tarjeta key={p.id} onPress={() => router.push(`/punto/${p.id}`)}>
          <Text style={{ fontSize: 17, color: colores.textoSuave }}>
            N° {p.numero} · Sector {p.sector_nombre}
          </Text>
          <Text style={{ fontSize: 21, fontWeight: '700', marginBottom: 6 }}>{p.nombre}</Text>
          {p.estado === 'Pendiente' ? <EstadoChip estado="Pendiente" /> : <EstadoChip estado="Punto nuevo" />}
          {p.ultima_fecha ? (
            <Text style={{ fontSize: 17, color: colores.textoSuave, marginTop: 6 }}>Última revisión: {fechaHora(p.ultima_fecha)}</Text>
          ) : null}
          {p.ultima_obs ? <Text style={{ fontSize: 17, marginTop: 4 }}>{p.ultima_obs}</Text> : null}
          <Text style={{ fontSize: 16, color: colores.primario, fontWeight: '700', marginTop: 8 }}>Ver historial ›</Text>
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
