// Detalle de un proyecto: estado, inspección, configuración, pendientes y reportes.
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { colorEstado, colores } from '@/components/tema';
import { Boton, Etiqueta, Pantalla, Tarjeta, TextoSuave, Titulo, estilos } from '@/components/ui';
import { borrarArchivos } from '@/lib/archivos';
import {
  ESTADOS_PROYECTO,
  cambiarEstadoProyecto,
  db,
  descartarInspeccion,
  inspeccionEnCurso,
  listarPuntosPendientes,
  listarReportes,
  obtenerProyecto,
  type Inspeccion,
  type Proyecto,
  type Reporte,
} from '@/lib/db';
import { fechaHora } from '@/lib/fechas';

export default function DetalleProyecto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proyectoId = Number(id);
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [enCurso, setEnCurso] = useState<Inspeccion | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [totalPuntos, setTotalPuntos] = useState(0);
  const [reportes, setReportes] = useState<Reporte[]>([]);

  const cargar = useCallback(async () => {
    setProyecto(await obtenerProyecto(proyectoId));
    setEnCurso(await inspeccionEnCurso(proyectoId));
    setPendientes((await listarPuntosPendientes(proyectoId)).length);
    const t = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM puntos p JOIN sectores s ON s.id = p.sector_id WHERE s.proyecto_id = ?`,
      proyectoId
    );
    setTotalPuntos(t?.n ?? 0);
    setReportes(await listarReportes(proyectoId));
  }, [proyectoId]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  if (!proyecto) return <Pantalla>{null}</Pantalla>;

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

  return (
    <Pantalla>
      <Stack.Screen options={{ title: proyecto.nombre }} />

      <Tarjeta>
        <Titulo>{proyecto.nombre}</Titulo>
        <Text style={{ fontSize: 19, color: colores.texto }}>Área: {proyecto.area}</Text>
        <Text style={{ fontSize: 19, color: colores.texto, marginBottom: 12 }}>Código: {proyecto.codigo}</Text>
        <Boton
          titulo="Editar datos"
          variante="secundario"
          onPress={() => router.push({ pathname: '/proyecto/formulario', params: { id: proyectoId } })}
        />
      </Tarjeta>

      <Etiqueta>Estado del proyecto</Etiqueta>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {ESTADOS_PROYECTO.map((e) => {
          const activo = proyecto.estado === e;
          return (
            <Boton
              key={e}
              titulo={e}
              variante="secundario"
              onPress={async () => {
                await cambiarEstadoProyecto(proyectoId, e);
                cargar();
              }}
              colorTexto={activo ? colores.primarioTexto : colorEstado(e)}
              estilo={{
                flex: 1,
                paddingHorizontal: 4,
                borderColor: colorEstado(e),
                backgroundColor: activo ? colorEstado(e) : colores.tarjeta,
              }}
            />
          );
        })}
      </View>
      <TextoSuave>Estado actual: {proyecto.estado}</TextoSuave>

      <View style={{ height: 20 }} />
      {enCurso ? (
        <>
          <Boton
            titulo="Continuar inspección en curso"
            variante="exito"
            onPress={() =>
              router.push({ pathname: '/proyecto/[id]/inspeccion', params: { id: proyectoId, inspeccionId: enCurso.id } })
            }
          />
          <TextoSuave>Iniciada el {fechaHora(enCurso.iniciada)}</TextoSuave>
          <Boton titulo="Descartar inspección en curso" variante="peligro" onPress={descartar} estilo={{ marginTop: 8 }} />
        </>
      ) : (
        <Boton
          titulo="Iniciar inspección"
          variante="exito"
          deshabilitado={totalPuntos === 0}
          onPress={() => router.push({ pathname: '/proyecto/[id]/inspeccion', params: { id: proyectoId } })}
        />
      )}
      {totalPuntos === 0 ? (
        <TextoSuave>Primero agrega sectores y puntos en «Sectores y puntos».</TextoSuave>
      ) : null}

      <Boton
        titulo={`Puntos pendientes (${pendientes})`}
        variante="alerta"
        onPress={() => router.push(`/proyecto/${proyectoId}/pendientes`)}
        estilo={{ marginTop: 12 }}
      />
      <Boton
        titulo="Sectores y puntos"
        variante="secundario"
        onPress={() => router.push(`/proyecto/${proyectoId}/configuracion`)}
      />

      <View style={{ height: 16 }} />
      <Titulo>Reportes generados</Titulo>
      {reportes.length === 0 ? (
        <TextoSuave>Todavía no hay reportes.</TextoSuave>
      ) : (
        reportes.map((r) => (
          <Tarjeta key={r.id} onPress={() => router.push(`/reporte/${r.id}`)}>
            <Text style={estilos.opcionTexto}>{r.nombre}</Text>
            <Text style={{ fontSize: 17, color: colores.textoSuave }}>{fechaHora(r.fecha)}</Text>
            <Text style={{ fontSize: 17, marginTop: 4 }}>
              {r.total} puntos ·{' '}
              <Text style={{ color: colores.cerrado, fontWeight: '800' }}>{r.cerrados} cerrados</Text> ·{' '}
              <Text style={{ color: colores.pendiente, fontWeight: '800' }}>{r.pendientes} pendientes</Text>
            </Text>
          </Tarjeta>
        ))
      )}
    </Pantalla>
  );
}
