import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import { ComponentRef, Ref, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export type TextInputRef = ComponentRef<typeof TextInput>;

export type InputProps = TextInputProps & {
  label: string;
  ref?: Ref<TextInputRef>;
};

export function Input({
  label,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ref,
  ...props
}: InputProps) {
  const { colors, radius } = useTheme();
  const [foco, setFoco] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const EyeIcon = visivel ? EyeOff : Eye;

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
          secureTextEntry={secureTextEntry && !visivel}
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
            {
              borderRadius: radius.md,
              borderColor: foco ? colors.ring : colors.input,
              backgroundColor: colors.card,
              color: colors.foreground,
            },
            secureTextEntry && styles.withEye,
            style,
          ]}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visivel ? 'Esconder senha' : 'Mostrar senha'}
            hitSlop={8}
            onPress={() => setVisivel(v => !v)}
            style={styles.eye}
          >
            <EyeIcon size={20} color={colors.mutedForeground} />
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
  withEye: { paddingRight: 48 },
  eye: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
