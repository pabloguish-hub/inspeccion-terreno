// Inspección en terreno: elegir sector y punto, tomar fotos, cerrar el punto y generar el reporte.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import { colores } from '@/components/tema';
import { Boton, Campo, Etiqueta, Pantalla, Selector, Tarjeta, TextoSuave, Titulo, type Opcion } from '@/components/ui';
import { borrarArchivos, tomarFotoCuadrada, uriDe } from '@/lib/archivos';
import {
  abrirPuntoEnInspeccion,
  agregarFoto,
  cerrarPuntoEnInspeccion,
  contarPuntosCerradosEnInspeccion,
  crearInspeccion,
  eliminarFoto,
  listarFotos,
  obtenerProyecto,
  obtenerPunto,
  puntoAbierto,
  puntosDisponibles,
  sectoresDisponibles,
  type EstadoCierre,
  type Foto,
} from '@/lib/db';
import { fecha } from '@/lib/fechas';
import { generarReporte } from '@/lib/pdf';

type Paso = 'seleccion' | 'fotos' | 'cierre' | 'nombre' | 'generando';

export default function InspeccionScreen() {
  const params = useLocalSearchParams<{ id: string; inspeccionId?: string; puntoId?: string }>();
  const proyectoId = Number(params.id);

  const [inspeccionId, setInspeccionId] = useState<number | null>(null);
  const [paso, setPaso] = useState<Paso>('seleccion');
  const [sectores, setSectores] = useState<Opcion<number>[]>([]);
  const [puntos, setPuntos] = useState<Opcion<number>[]>([]);
  const [sectorId, setSectorId] = useState<number | null>(null);
  const [puntoId, setPuntoId] = useState<number | null>(null);
  const [ipId, setIpId] = useState<number | null>(null); // punto abierto en esta inspección
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [estado, setEstado] = useState<EstadoCierre | null>(null);
  const [accion, setAccion] = useState<'continuar' | 'finalizar'>('continuar');
  const [cerrados, setCerrados] = useState(0);
  const [nombreReporte, setNombreReporte] = useState('');
  const iniciado = useRef(false);

  // Al entrar: crear la inspección (o retomar la que estaba en curso)
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    (async () => {
      let idInsp = params.inspeccionId ? Number(params.inspeccionId) : null;
      if (!idInsp) idInsp = await crearInspeccion(proyectoId);
      setInspeccionId(idInsp);
      setCerrados(await contarPuntosCerradosEnInspeccion(idInsp));

      const abierto = await puntoAbierto(idInsp);
      if (abierto) {
        // Había un punto a medio hacer (por ejemplo, se cerró la app): lo retomamos
        const p = await obtenerPunto(abierto.punto_id);
        setSectorId(p?.sector_id ?? null);
        setPuntoId(abierto.punto_id);
        setIpId(abierto.id);
        setFotos(await listarFotos(abierto.id));
        setPaso('fotos');
      } else if (params.puntoId) {
        // Venimos desde "Puntos pendientes" para reinspeccionar un punto
        const p = await obtenerPunto(Number(params.puntoId));
        const disponible = p && (await puntosDisponibles(p.sector_id, idInsp)).some((d) => d.id === p.id);
        if (p && disponible) {
          setSectorId(p.sector_id);
          setPuntoId(p.id);
        }
      }
    })();
  }, [params.inspeccionId, params.puntoId, proyectoId]);

  // Listas de los menús desplegables; se recargan al cambiar "recarga"
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    if (!inspeccionId) return;
    sectoresDisponibles(proyectoId, inspeccionId).then((lista) =>
      setSectores(lista.map((s) => ({ valor: s.id, texto: s.nombre })))
    );
  }, [inspeccionId, proyectoId, recarga]);

  useEffect(() => {
    if (!inspeccionId || !sectorId) return;
    puntosDisponibles(sectorId, inspeccionId).then((lista) =>
      setPuntos(
        lista.map((p) => ({
          valor: p.id,
          texto: p.nombre,
          detalle: p.estado === 'Pendiente' ? '⚠ Pendiente: reinspección' : undefined,
          color: colores.pendiente,
        }))
      )
    );
  }, [inspeccionId, sectorId, recarga]);

  // Nombres del punto actual (se leen aparte porque al abrirlo deja de estar en la lista)
  const [sectorNombre, setSectorNombre] = useState('');
  const [puntoNombre, setPuntoNombre] = useState('');
  useEffect(() => {
    if (!puntoId) return;
    obtenerPunto(puntoId).then((p) => {
      setSectorNombre(p?.sector_nombre ?? '');
      setPuntoNombre(p?.nombre ?? '');
    });
  }, [puntoId]);

  async function tomarFoto() {
    if (!inspeccionId || !puntoId) return;
    setProcesandoFoto(true);
    try {
      const archivo = await tomarFotoCuadrada();
      if (!archivo) return; // el usuario canceló la cámara
      let idPunto = ipId;
      if (!idPunto) {
        idPunto = await abrirPuntoEnInspeccion(inspeccionId, puntoId);
        setIpId(idPunto);
      }
      await agregarFoto(idPunto, archivo);
      setFotos(await listarFotos(idPunto));
      setPaso('fotos');
    } catch (e) {
      Alert.alert('No se pudo tomar la foto', e instanceof Error ? e.message : String(e));
    } finally {
      setProcesandoFoto(false);
    }
  }

  function quitarFoto(f: Foto) {
    Alert.alert('Quitar foto', '¿Quitar esta foto del punto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          borrarArchivos([await eliminarFoto(f.id)]);
          if (ipId) setFotos(await listarFotos(ipId));
        },
      },
    ]);
  }

  function irACierre(a: 'continuar' | 'finalizar') {
    setAccion(a);
    setObservacion('');
    setEstado(null);
    setPaso('cierre');
  }

  async function sugerirNombre() {
    const p = await obtenerProyecto(proyectoId);
    setNombreReporte(`Inspección ${p?.codigo ?? ''} ${fecha(new Date().toISOString())}`.trim());
    setPaso('nombre');
  }

  async function guardarCierre() {
    if (!ipId || !estado) return;
    await cerrarPuntoEnInspeccion(ipId, observacion.trim(), estado);
    setCerrados((n) => n + 1);
    // El sector se mantiene y el punto se borra
    setPuntoId(null);
    setIpId(null);
    setFotos([]);
    if (accion === 'continuar') {
      setPaso('seleccion');
      // Si el sector ya no tiene puntos disponibles, se deja sin elegir
      if (inspeccionId) {
        const quedan = await sectoresDisponibles(proyectoId, inspeccionId);
        if (!quedan.some((s) => s.id === sectorId)) setSectorId(null);
      }
      setRecarga((n) => n + 1);
    } else {
      await sugerirNombre();
    }
  }

  async function generar() {
    if (!inspeccionId) return;
    setPaso('generando');
    try {
      const reporteId = await generarReporte(inspeccionId, nombreReporte.trim());
      router.replace(`/reporte/${reporteId}`);
    } catch (e) {
      setPaso('nombre');
      Alert.alert('No se pudo generar el PDF', e instanceof Error ? e.message : String(e));
    }
  }


  // ---------- Paso: generando PDF ----------
  if (paso === 'generando') {
    return (
      <Pantalla scroll={false}>
        <Stack.Screen options={{ title: 'Generando reporte', headerBackVisible: false }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colores.primario} />
          <Titulo>Generando PDF…</Titulo>
          <TextoSuave>Esto puede tardar unos segundos si hay muchas fotos.</TextoSuave>
        </View>
      </Pantalla>
    );
  }

  // ---------- Paso: nombre del reporte ----------
  if (paso === 'nombre') {
    return (
      <Pantalla>
        <Stack.Screen options={{ title: 'Finalizar inspección' }} />
        <Titulo>Nombre del reporte</Titulo>
        <Campo etiqueta="Nombre" value={nombreReporte} onChangeText={setNombreReporte} autoFocus />
        <Boton titulo="Generar PDF" variante="exito" deshabilitado={!nombreReporte.trim()} onPress={generar} />
        <Boton titulo="Volver a la inspección" variante="secundario" onPress={() => setPaso('seleccion')} />
      </Pantalla>
    );
  }

  // ---------- Paso: cerrar punto (observación y estado) ----------
  if (paso === 'cierre') {
    return (
      <Pantalla>
        <Stack.Screen options={{ title: 'Cerrar punto' }} />
        <Tarjeta>
          <Text style={{ fontSize: 18 }}>Sector: {sectorNombre}</Text>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>Punto: {puntoNombre}</Text>
        </Tarjeta>
        <Campo
          etiqueta="Observación"
          value={observacion}
          onChangeText={setObservacion}
          multiline
          placeholder="Escribe lo observado en este punto"
        />
        <Etiqueta>Estado del punto</Etiqueta>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Boton
            titulo={estado === 'Cerrado' ? '✓ Cerrado' : 'Cerrado'}
            variante={estado === 'Cerrado' ? 'exito' : 'secundario'}
            colorTexto={estado === 'Cerrado' ? undefined : colores.cerrado}
            estilo={{ flex: 1, borderColor: colores.cerrado, minHeight: 80 }}
            onPress={() => setEstado('Cerrado')}
          />
          <Boton
            titulo={estado === 'Pendiente' ? '✓ Pendiente' : 'Pendiente'}
            variante={estado === 'Pendiente' ? 'alerta' : 'secundario'}
            colorTexto={estado === 'Pendiente' ? undefined : colores.pendiente}
            estilo={{ flex: 1, borderColor: colores.pendiente, minHeight: 80 }}
            onPress={() => setEstado('Pendiente')}
          />
        </View>
        <View style={{ height: 12 }} />
        <Boton
          titulo={accion === 'continuar' ? 'Guardar y continuar' : 'Guardar y finalizar'}
          deshabilitado={!estado}
          onPress={guardarCierre}
        />
        {!estado ? <TextoSuave>Elige Cerrado o Pendiente para poder guardar.</TextoSuave> : null}
        <Boton titulo="Volver a las fotos" variante="secundario" onPress={() => setPaso('fotos')} estilo={{ marginTop: 8 }} />
      </Pantalla>
    );
  }

  // ---------- Paso: fotos del punto ----------
  if (paso === 'fotos') {
    return (
      <Pantalla>
        <Stack.Screen options={{ title: 'Fotos del punto' }} />
        <Tarjeta>
          <Text style={{ fontSize: 18 }}>Sector: {sectorNombre}</Text>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>Punto: {puntoNombre}</Text>
          <TextoSuave>{fotos.length} foto(s). Toca una foto para quitarla.</TextoSuave>
        </Tarjeta>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {fotos.map((f) => (
            <Pressable key={f.id} onPress={() => quitarFoto(f)} style={{ width: '31%', aspectRatio: 1 }}>
              <Image source={{ uri: uriDe(f.archivo) }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
            </Pressable>
          ))}
        </View>
        <Boton titulo="📷 Agregar foto" onPress={tomarFoto} cargando={procesandoFoto} />
        <Boton titulo="Continuar" variante="exito" onPress={() => irACierre('continuar')} />
        <Boton titulo="Finalizar" variante="alerta" onPress={() => irACierre('finalizar')} />
      </Pantalla>
    );
  }

  // ---------- Paso: selección de sector y punto ----------
  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Inspección' }} />
      <TextoSuave>Puntos cerrados en esta inspección: {cerrados}</TextoSuave>
      <View style={{ height: 12 }} />
      <Selector
        etiqueta="Sector"
        opciones={sectores}
        valor={sectorId}
        onCambio={(v) => {
          setSectorId(v);
          setPuntoId(null);
        }}
        vacio="No quedan sectores con puntos por inspeccionar."
      />
      <Selector
        etiqueta="Punto de inspección"
        opciones={sectorId ? puntos : []}
        valor={puntoId}
        onCambio={setPuntoId}
        placeholder={sectorId ? 'Toca para elegir' : 'Primero elige un sector'}
        vacio="No quedan puntos disponibles en este sector."
      />
      <Boton
        titulo="📷 Tomar foto"
        deshabilitado={!puntoId}
        cargando={procesandoFoto}
        onPress={tomarFoto}
        estilo={{ minHeight: 90 }}
      />
      {sectores.length === 0 && inspeccionId ? (
        <TextoSuave>Ya no quedan puntos por inspeccionar en este proyecto.</TextoSuave>
      ) : null}
      {cerrados > 0 ? (
        <Boton titulo="Finalizar inspección" variante="alerta" onPress={sugerirNombre} estilo={{ marginTop: 24 }} />
      ) : null}
    </Pantalla>
  );
}
