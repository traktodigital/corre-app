import { ComponentRef, Ref, useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

export type TextInputRef = ComponentRef<typeof TextInput>;

export type InputProps = TextInputProps & {
  label: string;
  ref?: Ref<TextInputRef>;
};

/** Campo com rótulo (Campo do web): borda que acende em verde no foco. */
export function Input({
  label,
  style,
  onFocus,
  onBlur,
  ref,
  ...props
}: InputProps) {
  const { colors, radius } = useTheme();
  const [foco, setFoco] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text variant="small" style={styles.label}>
        {label}
      </Text>
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
          {
            borderRadius: radius.md,
            borderColor: foco ? colors.ring : colors.input,
            backgroundColor: colors.card,
            color: colors.foreground,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontWeight: '600' },
  input: { height: 48, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
});
