// Pantalla principal: lista de proyectos, filtrable por estado.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { colores } from '@/components/tema';
import { Boton, EstadoChip, Filtros, Pantalla, Tarjeta, TextoSuave, estilos } from '@/components/ui';
import { listarProyectos, type EstadoProyecto, type Proyecto } from '@/lib/db';

type Filtro = 'Todos' | EstadoProyecto;
const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'Todos', texto: 'Todos' },
  { valor: 'Pendiente', texto: 'Pendiente' },
  { valor: 'En ejecución', texto: 'En ejecución' },
  { valor: 'Cerrado', texto: 'Cerrado' },
];

export default function Proyectos() {
  const [filtro, setFiltro] = useState<Filtro>('Todos');
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);

  // Se recarga cada vez que se vuelve a esta pantalla
  useFocusEffect(
    useCallback(() => {
      listarProyectos(filtro === 'Todos' ? undefined : filtro).then(setProyectos);
    }, [filtro])
  );

  return (
    <Pantalla>
      <Boton titulo="+ Nuevo proyecto" onPress={() => router.push('/proyecto/formulario')} />
      <Filtros opciones={FILTROS} valor={filtro} onCambio={setFiltro} />

      {proyectos.length === 0 ? (
        <TextoSuave>
          {filtro === 'Todos' ? 'Aún no hay proyectos. Crea el primero.' : `No hay proyectos "${filtro}".`}
        </TextoSuave>
      ) : (
        proyectos.map((p) => (
          <Tarjeta key={p.id} onPress={() => router.push(`/proyecto/${p.id}`)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <Text style={[estilos.opcionTexto, { flex: 1 }]}>{p.nombre}</Text>
              <EstadoChip estado={p.estado} />
            </View>
            <Text style={{ fontSize: 18, color: colores.texto, marginTop: 6 }}>
              Área: {p.area} · Código: {p.codigo}
            </Text>
          </Tarjeta>
        ))
      )}
    </Pantalla>
  );
}
