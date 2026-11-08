// Historial de un punto: todas sus revisiones con fecha, fotos, observación, estado y documentos.
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { colores } from '@/components/tema';
import { EstadoChip, Pantalla, Tarjeta, Text, TextoSuave, Titulo } from '@/components/ui';
import { uriDe } from '@/lib/archivos';
import {
  documentosDePunto,
  historialPunto,
  listarFotos,
  nombreInspeccion,
  obtenerPunto,
  type Documento,
  type Foto,
} from '@/lib/db';
import { fechaHora } from '@/lib/fechas';

type Registro = Awaited<ReturnType<typeof historialPunto>>[number] & { fotos: Foto[]; documentos: Documento[] };

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
        const completos: Registro[] = [];
        for (const r of lista) {
          completos.push({ ...r, fotos: await listarFotos(r.id), documentos: await documentosDePunto(r.id) });
        }
        setRegistros(completos);
      })();
    }, [puntoId])
  );

  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Historial del punto' }} />
      {punto ? (
        <>
          <Text style={{ fontSize: 17, color: colores.textoSuave }}>
            N° {punto.numero} · Sector {punto.sector_nombre}
          </Text>
          <Titulo>{punto.nombre}</Titulo>
          <EstadoChip estado={punto.estado === 'Sin inspección' ? 'Por revisar' : punto.estado} />
          <View style={{ height: 16 }} />
        </>
      ) : null}

      {registros.length === 0 ? <TextoSuave>Este punto todavía no tiene revisiones.</TextoSuave> : null}

      {registros.map((r) => (
        <Tarjeta key={r.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: colores.primario }}>{nombreInspeccion(r.tipo, r.numero)}</Text>
            <EstadoChip estado={r.estado} />
          </View>
          <TextoSuave>{fechaHora(r.fecha)}</TextoSuave>
          <Text style={{ fontSize: 18, marginVertical: 6 }}>
            {r.estado === 'Anulado' ? 'Motivo: ' : ''}
            {r.observacion || 'Sin observación'}
          </Text>
          {r.documentos.length || r.doc_detalle ? (
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 6 }}>
              Documento de referencia: {r.documentos.map((d) => `${d.codigo}${d.rev ? ` Rev. ${d.rev}` : ''}`).join(' / ')}
              {r.doc_detalle ? `${r.documentos.length ? ', ' : ''}${r.doc_detalle}` : ''}
            </Text>
          ) : null}
          {r.fotos.map((f) => (
            <View key={f.id} style={{ marginBottom: 8 }}>
              <Image source={{ uri: uriDe(f.archivo) }} style={{ width: '100%', aspectRatio: 3 / 2, borderRadius: 3, backgroundColor: colores.grisClaro }} resizeMode="contain" />
              {f.pie ? <Text style={{ fontSize: 15, color: colores.textoSuave, textAlign: 'center' }}>{f.pie}</Text> : null}
            </View>
          ))}
        </Tarjeta>
      ))}
    </Pantalla>
  );
}
