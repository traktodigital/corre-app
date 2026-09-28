import { StyleSheet, View } from 'react-native';
import { LogIn, LogOut, User } from 'lucide-react-native';
import { Screen } from '../../components/layout';
import { Button, Card, EmptyState, IconBox, Text } from '../../components/ui';
import { useTheme } from '../../theme';
import { useAuth } from '../auth/AuthProvider';

const rotuloVeiculo: Record<string, string> = {
  moto: 'Moto',
  bike: 'Bike',
  carro: 'Carro',
  a_pe: 'A pé',
};

export function ProfileScreen() {
  const { colors } = useTheme();
  const { user, sair, sairDoModoVisitante } = useAuth();

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon={User}
          title="Crie sua conta primeiro"
          description="Entre pra ver seu perfil, sua carteirinha e seus descontos."
          action={
            <Button
              title="Entrar ou criar conta"
              icon={<LogIn size={16} color={colors.primaryForeground} />}
              onPress={sairDoModoVisitante}
            />
          }
        />
      </Screen>
    );
  }

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const linhas = [
    ['E-mail', user.email],
    ['Telefone', meta.telefone],
    ['Cidade', meta.cidade],
    [
      'Como roda',
      meta.tipo_veiculo ? rotuloVeiculo[meta.tipo_veiculo] : undefined,
    ],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <Screen>
      <Card padding={20} style={styles.header}>
        <IconBox size={56}>
          <User size={28} color={colors.highlight} />
        </IconBox>
        <View style={styles.flex}>
          <Text variant="h2" numberOfLines={1}>
            {meta.nome || 'Entregador CORRE'}
          </Text>
          <Text variant="caption" tone="muted">
            Plano free
          </Text>
        </View>
      </Card>

      <Card padding={0}>
        {linhas.map(([rotulo, valor], i) => (
          <View
            key={rotulo}
            style={[
              styles.linha,
              i > 0 && styles.divisor,
              i > 0 && { borderTopColor: colors.border },
            ]}
          >
            <Text variant="small" tone="muted">
              {rotulo}
            </Text>
            <Text variant="small" style={styles.valor} numberOfLines={1}>
              {valor}
            </Text>
          </View>
        ))}
      </Card>

      <Button
        variant="outline"
        size="lg"
        title="Sair da conta"
        icon={<LogOut size={16} color={colors.foreground} />}
        onPress={sair}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1 },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  divisor: { borderTopWidth: 1 },
  valor: { flexShrink: 1, fontWeight: '600' },
});
