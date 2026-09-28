import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AlertTriangle, LucideIcon, RotateCw } from 'lucide-react-native';
import { alpha, palette, useTheme } from '../../theme';
import { Button } from './Button';
import { IconBox } from './IconBox';
import { Text } from './Text';

/** SectionTitle do web: título à esquerda, dica à direita. */
export function SectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="h2">{children}</Text>
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.box,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
          borderRadius: radius['2xl'],
        },
      ]}
    >
      <IconBox size={56} tone="accent" style={styles.boxIcon}>
        <Icon size={28} color={colors.accentForeground} />
      </IconBox>
      <Text variant="h3" style={styles.center}>
        {title}
      </Text>
      <Text
        variant="small"
        tone="muted"
        style={[styles.center, styles.description]}
      >
        {description}
      </Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

/** EstadoErro do web: nunca deixa a tela em branco. */
export function ErrorState({
  title = 'Não deu pra carregar agora',
  description = 'Pode ser a sua conexão. Tente de novo em instantes.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.box,
        {
          borderColor: alpha(palette.danger, 0.4),
          backgroundColor: alpha(palette.danger, 0.05),
          borderRadius: radius['2xl'],
        },
      ]}
    >
      <IconBox size={48} tone="danger" style={styles.boxIcon}>
        <AlertTriangle size={24} color={colors.destructive} />
      </IconBox>
      <Text variant="h3" style={styles.center}>
        {title}
      </Text>
      <Text
        variant="small"
        tone="muted"
        style={[styles.center, styles.description]}
      >
        {description}
      </Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button
            variant="outline"
            title="Tentar de novo"
            icon={<RotateCw size={16} color={colors.foreground} />}
            onPress={onRetry}
          />
        </View>
      ) : null}
    </View>
  );
}

/** BlocoErro do web: aviso inline compacto. */
export function InlineError({ text }: { text: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.inline,
        {
          borderColor: alpha(palette.danger, 0.4),
          backgroundColor: alpha(palette.danger, 0.1),
          borderRadius: radius['2xl'],
        },
      ]}
    >
      <AlertTriangle size={20} color={colors.destructive} />
      <Text variant="small" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  box: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  boxIcon: { marginBottom: 12 },
  center: { textAlign: 'center' },
  description: { marginTop: 4, maxWidth: 320 },
  action: { marginTop: 20 },
  inline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    padding: 16,
  },
  flex: { flex: 1 },
});
