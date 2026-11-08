// Reemplazo de <Text> y <TextInput> que aplica la fuente del tema automáticamente.
// En Android una fuente propia no se pone en negrita con fontWeight: hay que usar
// el archivo de la variante negrita. Este componente elige el archivo correcto.
import type { ComponentProps } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { colores, fuentes } from './tema';

const NEGRITAS = new Set(['bold', '600', '700', '800', '900']);

function conFuente(style: TextProps['style']): TextStyle {
  const plano = StyleSheet.flatten(style) ?? {};
  const negrita = NEGRITAS.has(String(plano.fontWeight ?? ''));
  return { color: colores.texto, ...plano, fontFamily: negrita ? fuentes.negrita : fuentes.normal, fontWeight: undefined };
}

export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={conFuente(style)} />;
}

// En React 19 `ref` llega como una prop más, así que no hace falta forwardRef
export function TextInput({ style, ...props }: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput {...props} style={conFuente(style)} />;
}
