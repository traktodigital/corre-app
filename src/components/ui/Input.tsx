import { ComponentRef, Ref, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

export type TextInputRef = ComponentRef<typeof TextInput>;

export type InputProps = TextInputProps & {
  label: string;
  ref?: Ref<TextInputRef>;
};

/**
 * Campo com rótulo (Campo do web): borda que acende em verde no foco.
 * Com secureTextEntry, ganha o olho para mostrar a senha.
 */
export function Input({
  label,
  style,
  onFocus,
  onBlur,
  ref,
  secureTextEntry,
  ...props
}: InputProps) {
  const { colors, radius } = useTheme();
  const [foco, setFoco] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const IconeSenha = mostrarSenha ? EyeOff : Eye;

  return (
    <View style={styles.wrap}>
      <Text variant="small" style={styles.label}>
        {label}
      </Text>
      <View>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.highlight}
          onFocus={e => {
            setFoco(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFoco(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            secureTextEntry && styles.inputSenha,
            {
              borderRadius: radius.md,
              borderColor: foco ? colors.ring : colors.input,
              backgroundColor: colors.card,
              color: colors.foreground,
            },
            style,
          ]}
          {...(secureTextEntry
            ? { autoCapitalize: 'none' as const, autoCorrect: false }
            : null)}
          {...props}
          secureTextEntry={secureTextEntry && !mostrarSenha}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'
            }
            onPress={() => setMostrarSenha(atual => !atual)}
            hitSlop={8}
            style={styles.olho}
          >
            <IconeSenha size={20} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontWeight: '600' },
  input: { height: 48, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  inputSenha: { paddingRight: 48 },
  olho: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
