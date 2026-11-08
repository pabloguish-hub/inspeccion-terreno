// Detalle de un proyecto: datos, estado, inspección / re-inspección, pendientes y reportes.
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { colores } from '@/components/tema';
import { Boton, Etiqueta, Pantalla, ResumenEstados, TablaDatos, Tarjeta, Text, TextoSuave, Titulo, estilos } from '@/components/ui';
import { borrarArchivos } from '@/lib/archivos';
import {
  ESTADOS_PROYECTO,
  cambiarEstadoProyecto,
  descartarInspeccion,
  inspeccionEnCurso,
  listarReportes,
  nombreInspeccion,
  obtenerProyecto,
  resumenPuntos,
  siguienteInspeccion,
  type Inspeccion,
  type Proyecto,
  type Reporte,
  type TipoInspeccion,
} from '@/lib/db';
import { fechaDia, fechaHora } from '@/lib/fechas';

export default function DetalleProyecto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proyectoId = Number(id);
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [enCurso, setEnCurso] = useState<Inspeccion | null>(null);
  const [resumen, setResumen] = useState<Awaited<ReturnType<typeof resumenPuntos>> | null>(null);
  const [siguiente, setSiguiente] = useState<{ tipo: TipoInspeccion; numero: number } | null>(null);
  const [reportes, setReportes] = useState<Reporte[]>([]);

  const cargar = useCallback(async () => {
    setProyecto(await obtenerProyecto(proyectoId));
    setEnCurso(await inspeccionEnCurso(proyectoId));
    setResumen(await resumenPuntos(proyectoId));
    setSiguiente(await siguienteInspeccion(proyectoId));
    setReportes(await listarReportes(proyectoId));
  }, [proyectoId]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  if (!proyecto || !resumen || !siguiente) return <Pantalla>{null}</Pantalla>;

  function descartar() {
    if (!enCurso) return;
    Alert.alert(
      'Descartar inspección',
      'Se borrarán las fotos y observaciones de la inspección en curso. Los puntos vuelven a su estado anterior.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: async () => {
            borrarArchivos(await descartarInspeccion(enCurso.id));
            cargar();
          },
        },
      ]
    );
  }

  const porRevisar = resumen.pendientes + resumen.porRevisar;
  const esPrimera = siguiente.tipo === 'Inspección';

  return (
    <Pantalla>
      <Stack.Screen options={{ title: proyecto.nombre }} />

      <Titulo>{proyecto.nombre}</Titulo>
      <TablaDatos
        filas={[
          ['Código', proyecto.codigo],
          ['Revisión', proyecto.revision],
          ['Área', proyecto.area],
          ['Contratista', proyecto.contratista],
          ['N° contrato / OT', proyecto.contrato],
        ]}
      />
      <Boton
        titulo="Editar datos del proyecto"
        variante="secundario"
        onPress={() => router.push({ pathname: '/proyecto/formulario', params: { id: proyectoId } })}
      />

      {/* Resumen de puntos con los colores de los reportes */}
      <View style={{ height: 8 }} />
      <ResumenEstados {...resumen} />

      <View style={{ height: 12 }} />
      {enCurso ? (
        <>
          <Boton
            titulo={`Continuar ${nombreInspeccion(enCurso.tipo, enCurso.numero)}`}
            variante="exito"
            onPress={() =>
              router.push({ pathname: '/proyecto/[id]/inspeccion', params: { id: proyectoId, inspeccionId: enCurso.id } })
            }
          />
          <TextoSuave>
            En curso desde el {enCurso.fecha ? fechaDia(enCurso.fecha) : fechaHora(enCurso.iniciada)}
          </TextoSuave>
          <Boton titulo="Descartar inspección en curso" variante="peligro" onPress={descartar} estilo={{ marginTop: 8 }} />
        </>
      ) : resumen.total === 0 ? (
        <TextoSuave>Primero agrega sectores y puntos en «Sectores y puntos».</TextoSuave>
      ) : esPrimera || porRevisar > 0 ? (
        <Boton
          titulo={esPrimera ? 'Iniciar Primera Inspección' : `Nueva Re-Inspección N° ${siguiente.numero}`}
          onPress={() => router.push({ pathname: '/proyecto/[id]/inspeccion', params: { id: proyectoId } })}
          estilo={{ minHeight: 80 }}
        />
      ) : (
        <Tarjeta>
          <Text style={{ fontSize: 19, fontWeight: '700', color: colores.cerrado }}>
            Todos los puntos están cerrados o anulados. No se requiere nueva visita.
          </Text>
        </Tarjeta>
      )}

      <Boton
        titulo={`Puntos pendientes (${porRevisar})`}
        variante="secundario"
        onPress={() => router.push(`/proyecto/${proyectoId}/pendientes`)}
        estilo={{ marginTop: 8 }}
      />
      <Boton titulo="Dashboard del proyecto" variante="secundario" onPress={() => router.push(`/proyecto/${proyectoId}/dashboard`)} />
      <Boton titulo="Sectores y puntos" variante="secundario" onPress={() => router.push(`/proyecto/${proyectoId}/configuracion`)} />

      <Etiqueta>Estado del proyecto</Etiqueta>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {ESTADOS_PROYECTO.map((e) => (
          <Boton
            key={e}
            titulo={e}
            variante={proyecto.estado === e ? 'primario' : 'secundario'}
            onPress={async () => {
              await cambiarEstadoProyecto(proyectoId, e);
              cargar();
            }}
            estilo={{ flex: 1, paddingHorizontal: 4 }}
          />
        ))}
      </View>

      <Titulo>Reportes</Titulo>
      {reportes.length === 0 ? (
        <TextoSuave>Todavía no hay reportes.</TextoSuave>
      ) : (
        reportes.map((r) => (
          <Tarjeta key={r.id} onPress={() => router.push(`/reporte/${r.id}`)}>
            <Text style={estilos.opcionTexto}>{r.nombre}</Text>
            <Text style={{ fontSize: 17, color: colores.textoSuave }}>
              {r.codigo ? `${r.codigo} · ` : ''}
              {fechaHora(r.fecha)}
            </Text>
            <Text style={{ fontSize: 17, marginTop: 4 }}>
              {r.total} puntos ·{' '}
              <Text style={{ color: colores.cerrado, fontWeight: '700' }}>{r.cerrados} cerrados</Text> ·{' '}
              <Text style={{ color: colores.pendiente, fontWeight: '700' }}>{r.pendientes} pendientes</Text>
              {r.anulados ? ` · ${r.anulados} anulados` : ''}
            </Text>
          </Tarjeta>
        ))
      )}
    </Pantalla>
  );
}
