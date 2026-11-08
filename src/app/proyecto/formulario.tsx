// Crear o editar un proyecto: datos de portada, alcance y documentos de referencia.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { colores } from '@/components/tema';
import { Boton, Campo, ModalCampos, Pantalla, Tarjeta, Text, TextoSuave, Titulo, type CampoModal } from '@/components/ui';
import { borrarArchivos } from '@/lib/archivos';
import {
  eliminarProyecto,
  guardarProyecto,
  listarAlcance,
  listarDocumentos,
  obtenerProyecto,
  type Documento,
  type ItemAlcance,
  type TipoAlcance,
} from '@/lib/db';

// Qué se está editando en la ventana emergente (índice -1 = elemento nuevo)
type Edicion = { tipo: 'alcance'; alcance: TipoAlcance; indice: number } | { tipo: 'documento'; indice: number };

export default function FormularioProyecto() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = !!id;
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [revision, setRevision] = useState('0');
  const [area, setArea] = useState('');
  const [contratista, setContratista] = useState('');
  const [contrato, setContrato] = useState('');
  const [alcance, setAlcance] = useState<ItemAlcance[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const p = await obtenerProyecto(Number(id));
      if (!p) return;
      setNombre(p.nombre);
      setCodigo(p.codigo);
      setRevision(p.revision);
      setArea(p.area);
      setContratista(p.contratista);
      setContrato(p.contrato);
      setAlcance(await listarAlcance(p.id));
      setDocumentos(await listarDocumentos(p.id));
    })();
  }, [id]);

  const completo = nombre.trim() && area.trim() && codigo.trim();

  async function guardar() {
    setGuardando(true);
    try {
      const proyectoId = await guardarProyecto(
        editando ? Number(id) : null,
        {
          nombre: nombre.trim(),
          codigo: codigo.trim(),
          revision: revision.trim() || '0',
          area: area.trim(),
          contratista: contratista.trim(),
          contrato: contrato.trim(),
        },
        alcance,
        documentos
      );
      if (editando) router.back();
      else router.replace(`/proyecto/${proyectoId}`);
    } finally {
      setGuardando(false);
    }
  }

  function eliminar() {
    Alert.alert(
      'Eliminar proyecto',
      'Se borrarán el proyecto, sus sectores, puntos, inspecciones, fotos y reportes. Esto no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            borrarArchivos(await eliminarProyecto(Number(id)));
            router.dismissTo('/');
          },
        },
      ]
    );
  }

  // ---------- Ventana de edición de alcance / documento ----------

  function camposEdicion(): CampoModal[] {
    if (!edicion) return [];
    if (edicion.tipo === 'alcance') {
      return [{ clave: 'texto', etiqueta: edicion.alcance, valor: alcance[edicion.indice]?.texto, obligatorio: true }];
    }
    const d = documentos[edicion.indice];
    return [
      { clave: 'codigo', etiqueta: 'Código', valor: d?.codigo, obligatorio: true, placeholder: 'CDA-ET-015' },
      { clave: 'titulo', etiqueta: 'Título', valor: d?.titulo, obligatorio: true, placeholder: 'Especificación técnica de piping' },
      { clave: 'rev', etiqueta: 'Rev.', valor: d?.rev, placeholder: '1' },
    ];
  }

  function aceptarEdicion(v: Record<string, string>) {
    if (!edicion) return;
    if (edicion.tipo === 'alcance') {
      const item: ItemAlcance = { tipo: edicion.alcance, texto: v.texto };
      setAlcance((lista) => (edicion.indice < 0 ? [...lista, item] : lista.map((a, i) => (i === edicion.indice ? { ...a, ...item } : a))));
    } else {
      const doc: Documento = { codigo: v.codigo, titulo: v.titulo, rev: v.rev };
      setDocumentos((lista) => (edicion.indice < 0 ? [...lista, doc] : lista.map((d, i) => (i === edicion.indice ? { ...d, ...doc } : d))));
    }
    setEdicion(null);
  }

  function quitarDocumento(indice: number) {
    Alert.alert('Quitar documento', 'Si algún punto pendiente lo cita, dejará de aparecer en ese punto.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => setDocumentos((l) => l.filter((_, i) => i !== indice)) },
    ]);
  }

  const tituloModal =
    edicion?.tipo === 'alcance'
      ? `${edicion.indice < 0 ? 'Agregar' : 'Editar'} ítem ${edicion.alcance.toLowerCase()}`
      : `${edicion && edicion.indice >= 0 ? 'Editar' : 'Agregar'} documento`;

  return (
    <Pantalla>
      <Stack.Screen options={{ title: editando ? 'Editar proyecto' : 'Nuevo proyecto' }} />

      <Titulo>Datos del proyecto</Titulo>
      <Campo etiqueta="Nombre del proyecto" value={nombre} onChangeText={setNombre} placeholder="Montaje de soportes de piping, Eje 8" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 3 }}>
          <Campo etiqueta="Código" value={codigo} onChangeText={setCodigo} placeholder="CDA-ITO-015" autoCapitalize="characters" />
        </View>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Revisión" value={revision} onChangeText={setRevision} autoCapitalize="characters" />
        </View>
      </View>
      <Campo etiqueta="Área" value={area} onChangeText={setArea} placeholder="PMO — Estructuras / Piping" />
      <Campo etiqueta="Contratista" value={contratista} onChangeText={setContratista} placeholder="Nombre empresa contratista" />
      <Campo etiqueta="N° contrato / OT" value={contrato} onChangeText={setContrato} />

      {(['Incluido', 'Excluido'] as TipoAlcance[]).map((tipo) => (
        <View key={tipo}>
          <Titulo>Alcance: {tipo.toLowerCase()}</Titulo>
          {alcance.every((a) => a.tipo !== tipo) ? <TextoSuave>Sin ítems.</TextoSuave> : null}
          {alcance.map((a, i) =>
            a.tipo === tipo ? (
              <Tarjeta key={i}>
                <Text style={{ fontSize: 19, marginBottom: 10 }}>• {a.texto}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Boton titulo="Editar" variante="secundario" estilo={{ flex: 1, minHeight: 56, marginBottom: 0 }}
                    onPress={() => setEdicion({ tipo: 'alcance', alcance: tipo, indice: i })} />
                  <Boton titulo="Borrar" variante="peligro" estilo={{ flex: 1, minHeight: 56, marginBottom: 0 }}
                    onPress={() => setAlcance((l) => l.filter((_, j) => j !== i))} />
                </View>
              </Tarjeta>
            ) : null
          )}
          <Boton titulo={`+ Agregar ${tipo.toLowerCase()}`} variante="secundario"
            onPress={() => setEdicion({ tipo: 'alcance', alcance: tipo, indice: -1 })} />
        </View>
      ))}

      <Titulo>Documentos de referencia</Titulo>
      {documentos.length === 0 ? <TextoSuave>Sin documentos. Se usan para citar la norma en los puntos pendientes.</TextoSuave> : null}
      {documentos.map((d, i) => (
        <Tarjeta key={d.id ?? `n${i}`}>
          <Text style={{ fontSize: 19, fontWeight: '700', color: colores.primario }}>
            {d.codigo}
            {d.rev ? `  ·  Rev. ${d.rev}` : ''}
          </Text>
          <Text style={{ fontSize: 18, marginBottom: 10 }}>{d.titulo}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton titulo="Editar" variante="secundario" estilo={{ flex: 1, minHeight: 56, marginBottom: 0 }}
              onPress={() => setEdicion({ tipo: 'documento', indice: i })} />
            <Boton titulo="Borrar" variante="peligro" estilo={{ flex: 1, minHeight: 56, marginBottom: 0 }}
              onPress={() => quitarDocumento(i)} />
          </View>
        </Tarjeta>
      ))}
      <Boton titulo="+ Agregar documento" variante="secundario" onPress={() => setEdicion({ tipo: 'documento', indice: -1 })} />

      <View style={{ height: 20 }} />
      <Boton titulo="Guardar" onPress={guardar} deshabilitado={!completo} cargando={guardando} />
      {!completo ? <TextoSuave>Nombre, código y área son obligatorios.</TextoSuave> : null}
      <Boton titulo="Cancelar" variante="secundario" onPress={() => router.back()} estilo={{ marginTop: 8 }} />
      {editando ? <Boton titulo="Eliminar proyecto" variante="peligro" onPress={eliminar} estilo={{ marginTop: 30 }} /> : null}

      <ModalCampos
        visible={!!edicion}
        titulo={tituloModal}
        campos={camposEdicion()}
        textoAceptar={edicion && edicion.indice >= 0 ? 'Guardar' : 'Agregar'}
        onAceptar={aceptarEdicion}
        onCancelar={() => setEdicion(null)}
      />
    </Pantalla>
  );
}
