import { StyleSheet } from 'react-native';
import { MailCheck } from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Button, Card, IconBox, Text } from '../../components/ui';
import { useTheme } from '../../theme';
import { AuthLayout } from './AuthLayout';

export function ConfirmEmailScreen({
  navigation,
  route,
}: ScreenProps<'ConfirmEmail'>) {
  const { colors } = useTheme();

  return (
    <AuthLayout title="Confirma seu e-mail">
      <Card padding={20} style={styles.card}>
        <IconBox size={56} tone="accent">
          <MailCheck size={28} color={colors.accentForeground} />
        </IconBox>
        <Text variant="small" tone="muted" style={styles.center}>
          Mandamos um link pra{' '}
          <Text variant="small" style={styles.bold}>
            {route.params.email}
          </Text>
          . Clica nele pra ativar sua conta e voltar pro app.
        </Text>
      </Card>
      <Button
        size="lg"
        title="Já confirmei, entrar"
        onPress={() => navigation.replace('Login')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 16 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '700' },
});
