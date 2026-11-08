// Inspección y Re-Inspección en terreno:
// datos iniciales → elegir punto → fotos → cerrar punto (estado) → finalizar → próxima visita → PDF.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, View } from 'react-native';
import { colorEstado, colores } from '@/components/tema';
import {
  Boton,
  Campo,
  Etiqueta,
  ModalTexto,
  Pantalla,
  Selector,
  SelectorMultiple,
  Tarjeta,
  Text,
  TextoSuave,
  Titulo,
  type Opcion,
} from '@/components/ui';
import { borrarArchivos, tomarFoto, uriDe } from '@/lib/archivos';
import {
  ESTADOS_CIERRE,
  abrirPuntoEnInspeccion,
  agregarFoto,
  anularPuntos,
  cambiarPieFoto,
  cerrarPuntoEnInspeccion,
  contarPuntosCerradosEnInspeccion,
  crearInspeccion,
  eliminarFoto,
  guardarProximaVisita,
  hallazgoOriginal,
  listarDocumentos,
  listarFotos,
  listarPuntosPendientes,
  nombreInspeccion,
  obtenerAjustes,
  obtenerInspeccion,
  obtenerPunto,
  puntoAbierto,
  puntosDisponibles,
  puntosSinRevisar,
  sectoresDisponibles,
  siguienteInspeccion,
  type EstadoCierre,
  type Foto,
  type Inspeccion,
  type InspeccionPunto,
  type Punto,
} from '@/lib/db';
import { fechaDia, hoy, leerFecha } from '@/lib/fechas';
import { generarReporte } from '@/lib/pdf';

type Paso = 'cargando' | 'datos' | 'seleccion' | 'fotos' | 'cierre' | 'sinRevisar' | 'proxima' | 'generando';

export default function InspeccionScreen() {
  const params = useLocalSearchParams<{ id: string; inspeccionId?: string }>();
  const proyectoId = Number(params.id);

  const [paso, setPaso] = useState<Paso>('cargando');
  const [insp, setInsp] = useState<Inspeccion | null>(null);
  const [titulo, setTitulo] = useState('Inspección');

  // Datos iniciales
  const [fechaTexto, setFechaTexto] = useState(fechaDia(hoy()));
  const [sectorArea, setSectorArea] = useState('');
  const [personal, setPersonal] = useState('');

  // Selección del punto
  const [sectores, setSectores] = useState<Opcion<number>[]>([]);
  const [puntos, setPuntos] = useState<Opcion<number>[]>([]);
  const [sectorId, setSectorId] = useState<number | null>(null);
  const [puntoId, setPuntoId] = useState<number | null>(null);
  const [punto, setPunto] = useState<Awaited<ReturnType<typeof obtenerPunto>>>(null);
  const [hallazgo, setHallazgo] = useState<InspeccionPunto | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [cerrados, setCerrados] = useState(0);

  // Punto abierto: fotos y cierre
  const [ipId, setIpId] = useState<number | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [fotoPie, setFotoPie] = useState<Foto | null>(null);
  const [observacion, setObservacion] = useState('');
  const [estado, setEstado] = useState<EstadoCierre | null>(null);
  const [documentos, setDocumentos] = useState<Opcion<number>[]>([]);
  const [docsElegidos, setDocsElegidos] = useState<number[]>([]);
  const [detalle, setDetalle] = useState('');
  const [accion, setAccion] = useState<'continuar' | 'finalizar'>('continuar');

  // Finalización
  const [sinRevisar, setSinRevisar] = useState<Punto[]>([]);
  const [motivo, setMotivo] = useState('');
  const [proxFecha, setProxFecha] = useState('');
  const [proxResponsable, setProxResponsable] = useState('');
  const [pendientesFinal, setPendientesFinal] = useState<number[]>([]);

  const esRI = insp?.tipo === 'Re-Inspección';
  const iniciado = useRef(false);

  // ---------- Al entrar: retomar la inspección en curso o pedir los datos de una nueva ----------
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    (async () => {
      setDocumentos(
        (await listarDocumentos(proyectoId)).map((d) => ({
          valor: d.id,
          texto: `${d.codigo}${d.rev ? ` Rev. ${d.rev}` : ''}`,
          detalle: d.titulo,
        }))
      );
      if (!params.inspeccionId) {
        const sig = await siguienteInspeccion(proyectoId);
        setTitulo(nombreInspeccion(sig.tipo, sig.numero));
        const a = await obtenerAjustes();
        if (a.inspector_nombre) setPersonal(`${a.inspector_nombre} — ITO Teck`);
        setPaso('datos');
        return;
      }
      const i = await obtenerInspeccion(Number(params.inspeccionId));
      if (!i) return router.back();
      setInsp(i);
      setTitulo(nombreInspeccion(i.tipo, i.numero));
      setCerrados(await contarPuntosCerradosEnInspeccion(i.id));
      const abierto = await puntoAbierto(i.id);
      if (abierto) {
        // Había un punto a medio hacer (por ejemplo, se cerró la app): se retoma
        const p = await obtenerPunto(abierto.punto_id);
        setSectorId(p?.sector_id ?? null);
        setPuntoId(abierto.punto_id);
        setIpId(abierto.id);
        setFotos(await listarFotos(abierto.id));
        setPaso('fotos');
      } else {
        setPaso('seleccion');
      }
    })();
  }, [params.inspeccionId, proyectoId]);

  // ---------- Listas de los menús (se recargan al cambiar "recarga") ----------
  useEffect(() => {
    if (!insp) return;
    sectoresDisponibles(proyectoId, insp.id).then((lista) =>
      setSectores(lista.map((s) => ({ valor: s.id, texto: s.nombre })))
    );
  }, [insp, proyectoId, recarga]);

  useEffect(() => {
    if (!insp || !sectorId) return;
    puntosDisponibles(sectorId, insp.id).then((lista) =>
      setPuntos(
        lista.map((p) => ({
          valor: p.id,
          texto: `N° ${p.numero} — ${p.nombre}`,
          detalle: p.estado === 'Pendiente' ? 'Pendiente' : insp.tipo === 'Re-Inspección' ? 'Punto nuevo' : undefined,
          color: p.estado === 'Pendiente' ? colores.pendiente : colores.textoSuave,
        }))
      )
    );
  }, [insp, sectorId, recarga]);

  // Datos del punto actual y su hallazgo original (en re-inspecciones)
  useEffect(() => {
    if (!puntoId || !insp) return;
    obtenerPunto(puntoId).then(setPunto);
    hallazgoOriginal(puntoId, insp.id).then(setHallazgo);
  }, [puntoId, insp]);

  // ---------- Acciones ----------

  async function comenzar() {
    const fecha = leerFecha(fechaTexto);
    if (!fecha) return Alert.alert('Fecha no válida', 'Escribe la fecha como DD-MM-AAAA, por ejemplo 07-11-2026.');
    const id = await crearInspeccion(proyectoId, { fecha, sector_area: sectorArea.trim(), personal: personal.trim() });
    setInsp(await obtenerInspeccion(id));
    setPaso('seleccion');
  }

  async function abrirPunto(): Promise<number | null> {
    if (!insp || !puntoId) return null;
    if (ipId) return ipId;
    const id = await abrirPuntoEnInspeccion(insp.id, puntoId);
    setIpId(id);
    return id;
  }

  async function agregarFotoNueva() {
    if (!insp || !puntoId) return;
    setProcesandoFoto(true);
    try {
      const archivo = await tomarFoto();
      if (!archivo) return; // el usuario canceló la cámara
      const id = await abrirPunto();
      if (!id) return;
      await agregarFoto(id, archivo, punto?.nombre ?? '');
      setFotos(await listarFotos(id));
      setPaso('fotos');
    } catch (e) {
      Alert.alert('No se pudo tomar la foto', e instanceof Error ? e.message : String(e));
    } finally {
      setProcesandoFoto(false);
    }
  }

  async function sinFoto() {
    await abrirPunto();
    irACierre('continuar');
  }

  function opcionesFoto(f: Foto) {
    Alert.alert('Foto', f.pie || 'Sin pie de foto', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar foto',
        style: 'destructive',
        onPress: async () => {
          borrarArchivos([await eliminarFoto(f.id)]);
          if (ipId) setFotos(await listarFotos(ipId));
        },
      },
      { text: 'Editar pie', onPress: () => setFotoPie(f) },
    ]);
  }

  function irACierre(a: 'continuar' | 'finalizar') {
    setAccion(a);
    setObservacion('');
    setEstado(null);
    setDocsElegidos([]);
    setDetalle('');
    setPaso('cierre');
  }

  async function guardarCierre() {
    if (!ipId || !estado) return;
    await cerrarPuntoEnInspeccion(ipId, { observacion: observacion.trim(), estado, documentos: docsElegidos, detalle: detalle.trim() });
    setCerrados((n) => n + 1);
    // El sector se mantiene y el punto se borra
    setPuntoId(null);
    setPunto(null);
    setIpId(null);
    setFotos([]);
    if (insp) {
      const quedan = await sectoresDisponibles(proyectoId, insp.id);
      if (!quedan.some((s) => s.id === sectorId)) setSectorId(null);
    }
    setRecarga((n) => n + 1);
    if (accion === 'continuar') setPaso('seleccion');
    else await finalizar();
  }

  /** Revisa qué falta antes de generar el reporte. */
  async function finalizar() {
    if (!insp) return;
    const faltan = await puntosSinRevisar(proyectoId, insp.id);
    if (faltan.length && !esRI) {
      // En la primera inspección todos los puntos deben quedar revisados o anulados
      setSinRevisar(faltan);
      setMotivo('');
      setPaso('sinRevisar');
      return;
    }
    if (faltan.length && esRI) {
      Alert.alert(
        'Puntos sin revisar',
        `${faltan.length} punto(s) no se revisaron en esta re-inspección y quedan para la siguiente.`,
        [
          { text: 'Volver', style: 'cancel', onPress: () => setPaso('seleccion') },
          { text: 'Finalizar igual', onPress: () => pedirProximaVisita() },
        ]
      );
      return;
    }
    await pedirProximaVisita();
  }

  async function anularSinRevisar() {
    if (!insp) return;
    await anularPuntos(insp.id, sinRevisar.map((p) => p.id), motivo.trim());
    setCerrados((n) => n + sinRevisar.length);
    setRecarga((n) => n + 1);
    await pedirProximaVisita();
  }

  async function pedirProximaVisita() {
    const quedan = await listarPuntosPendientes(proyectoId);
    if (quedan.length === 0) return generar(null, null);
    setPendientesFinal(quedan.map((p) => p.numero));
    setPaso('proxima');
  }

  async function confirmarProxima() {
    const fecha = leerFecha(proxFecha);
    if (!fecha) return Alert.alert('Fecha no válida', 'Escribe la fecha como DD-MM-AAAA, por ejemplo 14-11-2026.');
    await generar(fecha, proxResponsable.trim());
  }

  async function generar(fecha: string | null, responsable: string | null) {
    if (!insp) return;
    setPaso('generando');
    try {
      await guardarProximaVisita(insp.id, fecha, responsable);
      const reporteId = await generarReporte(insp.id);
      router.replace(`/reporte/${reporteId}`);
    } catch (e) {
      setPaso('seleccion');
      Alert.alert('No se pudo generar el PDF', e instanceof Error ? e.message : String(e));
    }
  }

  // ---------- Pantallas de cada paso ----------

  const cabeceraPunto = punto ? (
    <View style={{ borderLeftWidth: 4, borderLeftColor: colores.primario, backgroundColor: colores.grisClaro, padding: 12, marginBottom: 14 }}>
      <Text style={{ fontSize: 17, color: colores.textoSuave }}>
        N° {punto.numero} · Sector {punto.sector_nombre}
      </Text>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colores.primario }}>{punto.nombre}</Text>
    </View>
  ) : null;

  if (paso === 'cargando') return <Pantalla>{null}</Pantalla>;

  if (paso === 'generando') {
    return (
      <Pantalla scroll={false}>
        <Stack.Screen options={{ title: 'Generando reporte', headerBackVisible: false }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colores.primario} />
          <Text style={{ fontSize: 24, fontWeight: '700', color: colores.primario, marginTop: 12 }}>Generando PDF…</Text>
          <TextoSuave>Esto puede tardar unos segundos si hay muchas fotos.</TextoSuave>
        </View>
      </Pantalla>
    );
  }

  if (paso === 'datos') {
    return (
      <Pantalla>
        <Stack.Screen options={{ title: titulo }} />
        <Titulo>Antecedentes de la inspección</Titulo>
        <Campo etiqueta="Fecha (DD-MM-AAAA)" value={fechaTexto} onChangeText={setFechaTexto} keyboardType="numbers-and-punctuation" />
        <Campo etiqueta="Sector / área" value={sectorArea} onChangeText={setSectorArea} placeholder="Sector planta — Eje 8" />
        <Campo
          etiqueta="Personal presente"
          value={personal}
          onChangeText={setPersonal}
          multiline
          placeholder="Nombre — Supervisor contratista; Nombre — ITO Teck"
        />
        <Boton titulo={`Comenzar ${titulo}`} onPress={comenzar} deshabilitado={!fechaTexto.trim()} />
        <Boton titulo="Cancelar" variante="secundario" onPress={() => router.back()} />
      </Pantalla>
    );
  }

  if (paso === 'sinRevisar') {
    return (
      <Pantalla>
        <Stack.Screen options={{ title: 'Puntos sin revisar' }} />
        <Tarjeta>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colores.pendiente }}>
            ⚠ Quedan {sinRevisar.length} punto(s) sin revisar
          </Text>
          <TextoSuave>
            La primera inspección debe revisar todos los puntos. Vuelve a revisarlos o anúlalos indicando el motivo.
          </TextoSuave>
        </Tarjeta>
        {sinRevisar.map((p) => (
          <Text key={p.id} style={{ fontSize: 19, marginBottom: 6 }}>
            N° {p.numero} — {p.nombre}
          </Text>
        ))}
        <View style={{ height: 12 }} />
        <Boton titulo="Volver a revisarlos" onPress={() => setPaso('seleccion')} />
        <View style={{ height: 20 }} />
        <Campo
          etiqueta="Motivo de anulación"
          value={motivo}
          onChangeText={setMotivo}
          multiline
          placeholder="Ej: soporte eliminado por cambio de ingeniería"
        />
        <Boton
          titulo={`Anular ${sinRevisar.length} punto(s) y finalizar`}
          variante="secundario"
          colorTexto={colores.primario}
          estilo={{ borderColor: colores.anulado, backgroundColor: colores.anulado }}
          deshabilitado={!motivo.trim()}
          onPress={anularSinRevisar}
        />
        {!motivo.trim() ? <TextoSuave>Para anular debes escribir el motivo.</TextoSuave> : null}
      </Pantalla>
    );
  }

  if (paso === 'proxima') {
    return (
      <Pantalla>
        <Stack.Screen options={{ title: 'Próxima visita' }} />
        <Titulo>Próxima visita</Titulo>
        <TextoSuave>
          Quedan puntos pendientes (N° {pendientesFinal.join(', ')}). Indica cuándo se verificará su cierre.
        </TextoSuave>
        <View style={{ height: 12 }} />
        <Campo etiqueta="Fecha nueva visita (DD-MM-AAAA)" value={proxFecha} onChangeText={setProxFecha}
          keyboardType="numbers-and-punctuation" placeholder="14-11-2026" />
        <Campo etiqueta="Responsable del cierre" value={proxResponsable} onChangeText={setProxResponsable}
          placeholder="Contratista — Supervisor / QA-QC" />
        <Boton titulo="Generar PDF" variante="exito" onPress={confirmarProxima}
          deshabilitado={!proxFecha.trim() || !proxResponsable.trim()} />
        <Boton titulo="Volver a la inspección" variante="secundario" onPress={() => setPaso('seleccion')} />
      </Pantalla>
    );
  }

  if (paso === 'cierre') {
    const anulado = estado === 'Anulado';
    const falta = !estado || (anulado && !observacion.trim());
    return (
      <Pantalla>
        <Stack.Screen options={{ title: 'Cerrar punto' }} />
        {cabeceraPunto}
        {esRI ? (
          <Tarjeta>
            <Etiqueta>Hallazgo original</Etiqueta>
            <Text style={{ fontSize: 18 }}>
              {hallazgo ? hallazgo.observacion || 'Sin observación' : 'Punto nuevo: no tiene hallazgo original.'}
            </Text>
          </Tarjeta>
        ) : null}
        <Campo
          etiqueta={anulado ? 'Motivo de anulación (obligatorio)' : esRI ? 'Verificación' : 'Observación'}
          value={observacion}
          onChangeText={setObservacion}
          multiline
          placeholder={anulado ? 'Por qué el punto deja de aplicar' : 'Lo observado en este punto'}
        />
        <Etiqueta>Estado del punto</Etiqueta>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ESTADOS_CIERRE.map((e) => {
            const c = colorEstado(e);
            const activo = estado === e;
            return (
              <Boton
                key={e}
                titulo={(activo ? '✓ ' : '') + e.toUpperCase()}
                variante="secundario"
                colorTexto={activo ? c.texto : e === 'Anulado' ? colores.primario : c.fondo}
                estilo={{ flex: 1, minHeight: 80, paddingHorizontal: 2, borderColor: c.fondo, backgroundColor: activo ? c.fondo : colores.tarjeta }}
                onPress={() => setEstado(e)}
              />
            );
          })}
        </View>
        {estado === 'Pendiente' ? (
          <View style={{ marginTop: 8 }}>
            <SelectorMultiple
              etiqueta="Documento de referencia"
              opciones={documentos}
              valores={docsElegidos}
              onCambio={setDocsElegidos}
              placeholder="Toca para elegir (opcional)"
              vacio="El proyecto no tiene documentos de referencia. Agrégalos en «Editar datos del proyecto»."
            />
            <Campo etiqueta="Detalle (opcional)" value={detalle} onChangeText={setDetalle}
              placeholder="Tabla 341.3.2 — Criterios de aceptación" />
          </View>
        ) : null}
        <View style={{ height: 12 }} />
        <Boton titulo={accion === 'continuar' ? 'Guardar y continuar' : 'Guardar y finalizar'} deshabilitado={falta} onPress={guardarCierre} />
        {!estado ? <TextoSuave>Elige el estado para poder guardar.</TextoSuave> : null}
        {anulado && !observacion.trim() ? <TextoSuave>Escribe el motivo de anulación.</TextoSuave> : null}
        <Boton titulo="Volver a las fotos" variante="secundario" onPress={() => setPaso('fotos')} estilo={{ marginTop: 8 }} />
      </Pantalla>
    );
  }

  if (paso === 'fotos') {
    return (
      <Pantalla>
        <Stack.Screen options={{ title: 'Fotos del punto' }} />
        {cabeceraPunto}
        <TextoSuave>{fotos.length} foto(s). Toca una foto para editar su pie o quitarla.</TextoSuave>
        <View style={{ height: 8 }} />
        {fotos.map((f) => (
          <Pressable key={f.id} onPress={() => opcionesFoto(f)} style={{ marginBottom: 12 }}>
            <Image source={{ uri: uriDe(f.archivo) }} style={{ width: '100%', aspectRatio: 3 / 2, borderRadius: 3, backgroundColor: colores.grisClaro }} resizeMode="contain" />
            <Text style={{ fontSize: 16, color: colores.textoSuave, textAlign: 'center', marginTop: 4 }}>{f.pie || 'Sin pie de foto'}</Text>
          </Pressable>
        ))}
        <Boton titulo="📷 Agregar foto" onPress={agregarFotoNueva} cargando={procesandoFoto} />
        <Boton titulo="Continuar" variante="exito" onPress={() => irACierre('continuar')} />
        <Boton titulo="Finalizar" variante="secundario" onPress={() => irACierre('finalizar')} />
        <ModalTexto
          visible={!!fotoPie}
          titulo="Pie de foto"
          etiqueta="Texto bajo la foto en el reporte"
          valorInicial={fotoPie?.pie ?? ''}
          onAceptar={async (t) => {
            if (fotoPie) await cambiarPieFoto(fotoPie.id, t);
            setFotoPie(null);
            if (ipId) setFotos(await listarFotos(ipId));
          }}
          onCancelar={() => setFotoPie(null)}
        />
      </Pantalla>
    );
  }

  // ---------- Paso: selección de sector y punto ----------
  return (
    <Pantalla>
      <Stack.Screen options={{ title: titulo }} />
      <TextoSuave>Puntos registrados en esta inspección: {cerrados}</TextoSuave>
      {esRI ? <TextoSuave>Solo se muestran los puntos pendientes y los puntos nuevos.</TextoSuave> : null}
      <View style={{ height: 12 }} />
      <Selector
        etiqueta="Sector"
        opciones={sectores}
        valor={sectorId}
        onCambio={(v) => {
          setSectorId(v);
          setPuntoId(null);
        }}
        vacio="No quedan puntos por revisar."
      />
      <Selector
        etiqueta="Punto de inspección"
        opciones={sectorId ? puntos : []}
        valor={puntoId}
        onCambio={setPuntoId}
        placeholder={sectorId ? 'Toca para elegir' : 'Primero elige un sector'}
        vacio="No quedan puntos disponibles en este sector."
      />
      <Boton titulo="📷 Tomar foto" deshabilitado={!puntoId} cargando={procesandoFoto} onPress={agregarFotoNueva} estilo={{ minHeight: 90 }} />
      <Boton titulo="Registrar sin foto" variante="secundario" deshabilitado={!puntoId} onPress={sinFoto} />
      {sectores.length === 0 ? <TextoSuave>Ya no quedan puntos por revisar en este proyecto.</TextoSuave> : null}
      {cerrados > 0 ? <Boton titulo="Finalizar inspección" variante="exito" onPress={finalizar} estilo={{ marginTop: 24 }} /> : null}
    </Pantalla>
  );
}
