// Historial de un punto: todas sus inspecciones con fecha, fotos, observación y estado.
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { colores } from '@/components/tema';
import { EstadoChip, Pantalla, Tarjeta, TextoSuave, Titulo, Text } from '@/components/ui';
import { uriDe } from '@/lib/archivos';
import { historialPunto, listarFotos, obtenerPunto, type Foto, type InspeccionPunto } from '@/lib/db';
import { fechaHora } from '@/lib/fechas';

type Registro = InspeccionPunto & { fotos: Foto[] };

export default function HistorialPunto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const puntoId = Number(id);
  const [punto, setPunto] = useState<Awaited<ReturnType<typeof obtenerPunto>>>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setPunto(await obtenerPunto(puntoId));
        const lista = await historialPunto(puntoId);
        const conFotos: Registro[] = [];
        for (const r of lista) conFotos.push({ ...r, fotos: await listarFotos(r.id) });
        setRegistros(conFotos);
      })();
    }, [puntoId])
  );

  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Historial del punto' }} />
      {punto ? (
        <Tarjeta>
          <Text style={{ fontSize: 17, color: colores.textoSuave }}>Sector: {punto.sector_nombre}</Text>
          <Titulo>{punto.nombre}</Titulo>
          <EstadoChip estado={punto.estado} />
        </Tarjeta>
      ) : null}

      {registros.length === 0 ? <TextoSuave>Este punto todavía no tiene inspecciones.</TextoSuave> : null}

      {registros.map((r, i) => (
        <Tarjeta key={r.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 19, fontWeight: '800' }}>{fechaHora(r.fecha)}</Text>
            <EstadoChip estado={r.estado} />
          </View>
          {i < registros.length - 1 ? <TextoSuave>Reinspección</TextoSuave> : null}
          <Text style={{ fontSize: 18, marginVertical: 6 }}>{r.observacion || 'Sin observación'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {r.fotos.map((f) => (
              <Image key={f.id} source={{ uri: uriDe(f.archivo) }} style={{ width: '31%', aspectRatio: 1, borderRadius: 6 }} />
            ))}
          </View>
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
