// Componentes visuales reutilizables: botones grandes, menús desplegables, etc.
// Todo el estilo viene de tema.ts; las pantallas no deben definir colores propios.
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colorEstado, colorEstadoProyecto, colores, tamanos } from './tema';
import { Text, TextInput } from './Texto';

export { Text, TextInput };

// ---------- Contenedor de pantalla ----------

export function Pantalla({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={estilos.pantalla} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[estilos.contenido, { flex: 1 }]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- Logo para la barra superior (versión blanca sobre azul) ----------

export function LogoBarra() {
  return (
    <Image
      source={require('../../assets/teck/logo-blanco.png')}
      style={{ width: 150, height: 36 }}
      resizeMode="contain"
      accessibilityLabel="Carmen de Andacollo / Teck"
    />
  );
}

// ---------- Botón grande ----------

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'exito' | 'alerta';

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  deshabilitado = false,
  cargando = false,
  estilo,
  colorTexto: colorTextoForzado,
}: {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBoton;
  deshabilitado?: boolean;
  cargando?: boolean;
  estilo?: ViewStyle;
  colorTexto?: string;
}) {
  const fondo = {
    primario: colores.primario,
    secundario: colores.tarjeta,
    peligro: colores.peligro,
    exito: colores.cerrado,
    alerta: colores.pendiente,
  }[variante];
  const colorTexto =
    colorTextoForzado ?? (variante === 'secundario' ? colores.primario : colores.primarioTexto);
  const inactivo = deshabilitado || cargando;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: fondo, opacity: inactivo ? 0.45 : pressed ? 0.75 : 1 },
        variante === 'secundario' && estilos.botonSecundario,
        estilo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} size="large" />
      ) : (
        <Text style={[estilos.botonTexto, { color: colorTexto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

// ---------- Textos ----------

/** Título de sección: azul Teck con una línea fina debajo, como en los reportes. */
export function Titulo({ children }: { children: ReactNode }) {
  return <Text style={estilos.titulo}>{children}</Text>;
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <Text style={estilos.etiqueta}>{children}</Text>;
}

export function TextoSuave({ children }: { children: ReactNode }) {
  return <Text style={estilos.textoSuave}>{children}</Text>;
}

export function Tarjeta({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [estilos.tarjeta, pressed && { opacity: 0.7 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={estilos.tarjeta}>{children}</View>;
}

/** Etiqueta de estado en mayúsculas. `tipo="proyecto"` usa los colores sobrios de proyecto. */
export function EstadoChip({ estado, tipo = 'punto' }: { estado: string | null | undefined; tipo?: 'punto' | 'proyecto' }) {
  const c = tipo === 'proyecto' ? colorEstadoProyecto(estado ?? '') : colorEstado(estado);
  return (
    <View style={[estilos.chip, { backgroundColor: c.fondo }]}>
      <Text style={[estilos.chipTexto, { color: c.texto }]}>{(estado ?? 'Abierto').toUpperCase()}</Text>
    </View>
  );
}

/** Tabla de datos estilo portada de reporte: etiqueta en gris a la izquierda, valor a la derecha. */
export function TablaDatos({ filas }: { filas: [string, string][] }) {
  return (
    <View style={estilos.tabla}>
      {filas.map(([etiqueta, valor], i) => (
        <View key={etiqueta} style={[estilos.tablaFila, i === filas.length - 1 && { borderBottomWidth: 0 }]}>
          <Text style={estilos.tablaEtiqueta}>{etiqueta}</Text>
          <Text style={estilos.tablaValor}>{valor || '—'}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------- Campo de texto ----------

export function Campo({ etiqueta, ...props }: TextInputProps & { etiqueta: string }) {
  return (
    <View style={{ marginBottom: tamanos.espacio }}>
      <Etiqueta>{etiqueta}</Etiqueta>
      <TextInput
        placeholderTextColor={colores.textoSuave}
        {...props}
        style={[estilos.campo, props.multiline && { minHeight: 130, textAlignVertical: 'top', paddingTop: 12 }]}
      />
    </View>
  );
}

// ---------- Menú desplegable grande ----------

export interface Opcion<T> {
  valor: T;
  texto: string;
  detalle?: string;
  color?: string;
}

export function Selector<T>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  placeholder = 'Toca para elegir',
  vacio = 'No hay opciones disponibles',
}: {
  etiqueta: string;
  opciones: Opcion<T>[];
  valor: T | null;
  onCambio: (v: T) => void;
  placeholder?: string;
  vacio?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const elegida = opciones.find((o) => o.valor === valor);
  return (
    <View style={{ marginBottom: tamanos.espacio }}>
      <Etiqueta>{etiqueta}</Etiqueta>
      <Pressable
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [estilos.selector, pressed && { opacity: 0.7 }]}
      >
        <Text style={[estilos.selectorTexto, !elegida && { color: colores.textoSuave }]} numberOfLines={2}>
          {elegida ? elegida.texto : placeholder}
        </Text>
        <Text style={estilos.selectorFlecha}>▼</Text>
      </Pressable>
      {elegida?.detalle ? (
        <Text style={[estilos.textoSuave, { color: elegida.color ?? colores.textoSuave, fontWeight: '700' }]}>
          {elegida.detalle}
        </Text>
      ) : null}

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <SafeAreaView style={[estilos.pantalla, { padding: tamanos.espacio }]}>
          <Titulo>{etiqueta}</Titulo>
          <FlatList
            data={opciones}
            keyExtractor={(_, i) => String(i)}
            ListEmptyComponent={<TextoSuave>{vacio}</TextoSuave>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onCambio(item.valor);
                  setAbierto(false);
                }}
                style={({ pressed }) => [
                  estilos.opcion,
                  item.valor === valor && { borderColor: colores.primario, borderWidth: 3 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={estilos.opcionTexto}>{item.texto}</Text>
                {item.detalle ? (
                  <Text style={[estilos.opcionDetalle, { color: item.color ?? colores.textoSuave }]}>
                    {item.detalle}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
          <Boton titulo="Cancelar" variante="secundario" onPress={() => setAbierto(false)} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ---------- Ventana para escribir un texto (nombre de sector, punto, reporte...) ----------

export function ModalTexto({
  visible,
  titulo,
  etiqueta,
  valorInicial = '',
  textoAceptar = 'Guardar',
  onAceptar,
  onCancelar,
}: {
  visible: boolean;
  titulo: string;
  etiqueta: string;
  valorInicial?: string;
  textoAceptar?: string;
  onAceptar: (texto: string) => void;
  onCancelar: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <KeyboardAvoidingView
        style={estilos.fondoModal}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* El contenido se crea de nuevo cada vez que se abre, así el texto parte desde valorInicial */}
        {visible ? (
          <CajaTexto
            titulo={titulo}
            etiqueta={etiqueta}
            valorInicial={valorInicial}
            textoAceptar={textoAceptar}
            onAceptar={onAceptar}
            onCancelar={onCancelar}
          />
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CajaTexto(props: {
  titulo: string;
  etiqueta: string;
  valorInicial: string;
  textoAceptar: string;
  onAceptar: (texto: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(props.valorInicial);
  return (
    <View style={estilos.cajaModal}>
      <Titulo>{props.titulo}</Titulo>
      <Campo etiqueta={props.etiqueta} value={texto} onChangeText={setTexto} autoFocus />
      <Boton
        titulo={props.textoAceptar}
        deshabilitado={!texto.trim()}
        onPress={() => props.onAceptar(texto.trim())}
      />
      <Boton titulo="Cancelar" variante="secundario" onPress={props.onCancelar} />
    </View>
  );
}

// ---------- Botones de filtro (tipo pestaña) ----------

export function Filtros<T extends string>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { valor: T; texto: string }[];
  valor: T;
  onCambio: (v: T) => void;
}) {
  return (
    <View style={estilos.filtros}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onCambio(o.valor)}
            style={[estilos.filtro, activo && { backgroundColor: colores.primario }]}
          >
            <Text style={[estilos.filtroTexto, activo && { color: colores.primarioTexto }]}>{o.texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const borde = { borderWidth: tamanos.linea, borderColor: colores.borde, borderRadius: tamanos.radio };

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: tamanos.espacio, paddingBottom: 40 },
  boton: {
    minHeight: tamanos.boton,
    borderRadius: tamanos.radio,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  botonSecundario: { borderWidth: 2, borderColor: colores.primario },
  botonTexto: { fontSize: 21, fontWeight: '700', textAlign: 'center' },
  titulo: {
    fontSize: tamanos.titulo,
    fontWeight: '700',
    color: colores.primario,
    borderBottomWidth: 2,
    borderBottomColor: colores.primario,
    paddingBottom: 4,
    marginBottom: 14,
  },
  etiqueta: {
    fontSize: 16,
    fontWeight: '700',
    color: colores.textoSuave,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  textoSuave: { fontSize: tamanos.chico, color: colores.textoSuave, marginTop: 4 },
  tarjeta: { ...borde, backgroundColor: colores.tarjeta, padding: tamanos.espacio, marginBottom: 12 },
  chip: { alignSelf: 'flex-start', borderRadius: tamanos.radio, paddingHorizontal: 10, paddingVertical: 4 },
  chipTexto: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  tabla: { ...borde, marginBottom: tamanos.espacio },
  tablaFila: { flexDirection: 'row', borderBottomWidth: tamanos.linea, borderBottomColor: colores.borde },
  tablaEtiqueta: {
    width: '40%',
    backgroundColor: colores.grisClaro,
    padding: 10,
    fontSize: 17,
    fontWeight: '700',
    borderRightWidth: tamanos.linea,
    borderRightColor: colores.borde,
  },
  tablaValor: { flex: 1, padding: 10, fontSize: 18 },
  campo: {
    ...borde,
    backgroundColor: colores.tarjeta,
    fontSize: tamanos.texto,
    color: colores.texto,
    paddingHorizontal: 14,
    minHeight: tamanos.boton - 4,
  },
  selector: {
    ...borde,
    backgroundColor: colores.tarjeta,
    minHeight: tamanos.boton,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  selectorTexto: { flex: 1, fontSize: tamanos.texto, fontWeight: '700' },
  selectorFlecha: { fontSize: 20, color: colores.primario, marginLeft: 8 },
  opcion: { ...borde, backgroundColor: colores.tarjeta, padding: 18, marginBottom: 10, minHeight: tamanos.boton, justifyContent: 'center' },
  opcionTexto: { fontSize: 22, fontWeight: '700' },
  opcionDetalle: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 16 },
  cajaModal: { backgroundColor: colores.fondo, borderRadius: tamanos.radio, padding: tamanos.espacio },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: tamanos.espacio },
  filtro: {
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: tamanos.radio,
    borderWidth: 2,
    borderColor: colores.primario,
    backgroundColor: colores.tarjeta,
    justifyContent: 'center',
  },
  filtroTexto: { fontSize: 18, fontWeight: '700', color: colores.primario },
});
