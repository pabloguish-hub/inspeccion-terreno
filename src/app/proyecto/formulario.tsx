// Crear o editar un proyecto (Nombre, Área y Código).
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Boton, Campo, Pantalla } from '@/components/ui';
import { borrarArchivos } from '@/lib/archivos';
import { crearProyecto, editarProyecto, eliminarProyecto, obtenerProyecto } from '@/lib/db';

export default function FormularioProyecto() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = !!id;
  const [nombre, setNombre] = useState('');
  const [area, setArea] = useState('');
  const [codigo, setCodigo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!id) return;
    obtenerProyecto(Number(id)).then((p) => {
      if (!p) return;
      setNombre(p.nombre);
      setArea(p.area);
      setCodigo(p.codigo);
    });
  }, [id]);

  const completo = nombre.trim() && area.trim() && codigo.trim();

  async function guardar() {
    setGuardando(true);
    try {
      if (editando) {
        await editarProyecto(Number(id), nombre.trim(), area.trim(), codigo.trim());
        router.back();
      } else {
        const nuevo = await crearProyecto(nombre.trim(), area.trim(), codigo.trim());
        router.replace(`/proyecto/${nuevo}`);
      }
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

  return (
    <Pantalla>
      <Stack.Screen options={{ title: editando ? 'Editar proyecto' : 'Nuevo proyecto' }} />
      <Campo etiqueta="Nombre del proyecto" value={nombre} onChangeText={setNombre} placeholder="Ej: Mantención chancador" />
      <Campo etiqueta="Área" value={area} onChangeText={setArea} placeholder="Ej: Planta concentradora" />
      <Campo etiqueta="Código" value={codigo} onChangeText={setCodigo} placeholder="Ej: PRY-2026-015" autoCapitalize="characters" />
      <Boton titulo="Guardar" onPress={guardar} deshabilitado={!completo} cargando={guardando} />
      <Boton titulo="Cancelar" variante="secundario" onPress={() => router.back()} />
      {editando ? <Boton titulo="Eliminar proyecto" variante="peligro" onPress={eliminar} estilo={{ marginTop: 30 }} /> : null}
    </Pantalla>
  );
}
