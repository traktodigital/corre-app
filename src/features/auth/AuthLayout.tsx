import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../../components/layout/Logo';
import { Text } from '../../components/ui';
import { useTheme } from '../../theme';

/** Moldura das telas de entrar/criar conta: logo, título, subtítulo e conteúdo. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors, layout } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: layout.screenPadding + 4,
          },
        ]}
      >
        <View style={[styles.content, { maxWidth: layout.maxWidth }]}>
          <Logo size={40} />
          <View style={styles.header}>
            <Text variant="h1">{title}</Text>
            {subtitle ? (
              <Text variant="small" tone="muted">
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { width: '100%', alignSelf: 'center', flexGrow: 1 },
  header: { marginTop: 32, gap: 6 },
  body: { marginTop: 28, gap: 16 },
  footer: { marginTop: 24, alignItems: 'center', gap: 12 },
});
