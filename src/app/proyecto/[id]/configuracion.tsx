// Configuración del proyecto: agregar, editar y eliminar sectores y sus puntos de inspección.
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { colores } from '@/components/tema';
import { Boton, EstadoChip, ModalTexto, Pantalla, Tarjeta, TextoSuave, estilos, Text } from '@/components/ui';
import { borrarArchivos } from '@/lib/archivos';
import {
  contarHistorialPunto,
  crearPunto,
  crearSector,
  eliminarPunto,
  eliminarSector,
  listarPuntos,
  listarSectores,
  renombrarPunto,
  renombrarSector,
  type Punto,
  type Sector,
} from '@/lib/db';

type SectorConPuntos = Sector & { puntos: Punto[] };

// Qué está escribiendo el usuario en la ventana de texto
type Edicion =
  | { tipo: 'nuevoSector' }
  | { tipo: 'editarSector'; sector: Sector }
  | { tipo: 'nuevoPunto'; sector: Sector }
  | { tipo: 'editarPunto'; punto: Punto };

export default function Configuracion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proyectoId = Number(id);
  const [sectores, setSectores] = useState<SectorConPuntos[]>([]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);

  const cargar = useCallback(async () => {
    const lista = await listarSectores(proyectoId);
    const conPuntos: SectorConPuntos[] = [];
    for (const s of lista) conPuntos.push({ ...s, puntos: await listarPuntos(s.id) });
    setSectores(conPuntos);
  }, [proyectoId]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  async function guardarTexto(texto: string) {
    if (!edicion) return;
    switch (edicion.tipo) {
      case 'nuevoSector':
        await crearSector(proyectoId, texto);
        break;
      case 'editarSector':
        await renombrarSector(edicion.sector.id, texto);
        break;
      case 'nuevoPunto':
        await crearPunto(edicion.sector.id, texto);
        break;
      case 'editarPunto':
        await renombrarPunto(edicion.punto.id, texto);
        break;
    }
    setEdicion(null);
    cargar();
  }

  function confirmarEliminarSector(s: SectorConPuntos) {
    Alert.alert(
      'Eliminar sector',
      `¿Eliminar "${s.nombre}" y sus ${s.puntos.length} puntos? También se borra su historial y sus fotos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            borrarArchivos(await eliminarSector(s.id));
            cargar();
          },
        },
      ]
    );
  }

  async function confirmarEliminarPunto(p: Punto) {
    const n = await contarHistorialPunto(p.id);
    Alert.alert(
      'Eliminar punto',
      n > 0
        ? `"${p.nombre}" tiene ${n} inspección(es) registradas. Se borrarán su historial y sus fotos.`
        : `¿Eliminar "${p.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            borrarArchivos(await eliminarPunto(p.id));
            cargar();
          },
        },
      ]
    );
  }

  const tituloModal = {
    nuevoSector: 'Nuevo sector',
    editarSector: 'Editar sector',
    nuevoPunto: 'Nuevo punto de inspección',
    editarPunto: 'Editar punto',
  };
  const valorInicial =
    edicion?.tipo === 'editarSector'
      ? edicion.sector.nombre
      : edicion?.tipo === 'editarPunto'
        ? edicion.punto.nombre
        : '';

  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Sectores y puntos' }} />
      <Boton titulo="+ Agregar sector" onPress={() => setEdicion({ tipo: 'nuevoSector' })} />

      {sectores.length === 0 ? <TextoSuave>No hay sectores. Agrega el primero.</TextoSuave> : null}

      {sectores.map((s) => (
        <Tarjeta key={s.id}>
          <Text style={[estilos.titulo, { marginBottom: 8 }]}>{s.nombre}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton
              titulo="Editar"
              variante="secundario"
              estilo={{ flex: 1 }}
              onPress={() => setEdicion({ tipo: 'editarSector', sector: s })}
            />
            <Boton titulo="Eliminar" variante="peligro" estilo={{ flex: 1 }} onPress={() => confirmarEliminarSector(s)} />
          </View>

          <Text style={[estilos.etiqueta, { marginTop: 8 }]}>Puntos de inspección ({s.puntos.length})</Text>
          {s.puntos.map((p) => (
            <View key={p.id} style={{ borderTopWidth: 1, borderTopColor: colores.borde, paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: colores.texto }}>
                  N° {p.numero} — {p.nombre}
                </Text>
                <EstadoChip estado={p.estado === 'Sin inspección' ? 'Por revisar' : p.estado} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Boton
                  titulo="Editar"
                  variante="secundario"
                  estilo={{ flex: 1, minHeight: 58, marginBottom: 0 }}
                  onPress={() => setEdicion({ tipo: 'editarPunto', punto: p })}
                />
                <Boton
                  titulo="Historial"
                  variante="secundario"
                  estilo={{ flex: 1, minHeight: 58, marginBottom: 0 }}
                  onPress={() => router.push(`/punto/${p.id}`)}
                />
                <Boton
                  titulo="Borrar"
                  variante="peligro"
                  estilo={{ flex: 1, minHeight: 58, marginBottom: 0 }}
                  onPress={() => confirmarEliminarPunto(p)}
                />
              </View>
            </View>
          ))}
          <Boton
            titulo="+ Agregar punto"
            estilo={{ marginTop: 8, marginBottom: 0 }}
            onPress={() => setEdicion({ tipo: 'nuevoPunto', sector: s })}
          />
        </Tarjeta>
      ))}

      <ModalTexto
        visible={!!edicion}
        titulo={edicion ? tituloModal[edicion.tipo] : ''}
        etiqueta={edicion?.tipo.includes('Sector') ? 'Nombre del sector' : 'Nombre del punto'}
        valorInicial={valorInicial}
        onAceptar={guardarTexto}
        onCancelar={() => setEdicion(null)}
      />
    </Pantalla>
  );
}
