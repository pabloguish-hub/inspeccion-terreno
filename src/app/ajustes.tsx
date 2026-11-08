// Ajustes generales de la app: datos del inspector que firman los reportes.
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Boton, Campo, Pantalla, TextoSuave, Titulo } from '@/components/ui';
import { guardarAjustes, obtenerAjustes } from '@/lib/db';

export default function AjustesScreen() {
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerAjustes().then((a) => {
      setNombre(a.inspector_nombre);
      setCargo(a.inspector_cargo);
    });
  }, []);

  async function guardar() {
    setGuardando(true);
    await guardarAjustes({ inspector_nombre: nombre.trim(), inspector_cargo: cargo.trim() });
    setGuardando(false);
    router.back();
  }

  return (
    <Pantalla>
      <Stack.Screen options={{ title: 'Ajustes' }} />
      <Titulo>Inspector</Titulo>
      <TextoSuave>Aparece en «Elaborado por» y en la firma de todos los reportes.</TextoSuave>
      <TextoSuave>Ejemplo: Pablo Muñoz — ITO Estructural</TextoSuave>
      <TextoSuave> </TextoSuave>
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Pablo Muñoz" autoCapitalize="words" />
      <Campo etiqueta="Cargo" value={cargo} onChangeText={setCargo} placeholder="ITO Estructural" />
      <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
      <Boton titulo="Cancelar" variante="secundario" onPress={() => router.back()} />
    </Pantalla>
  );
}
