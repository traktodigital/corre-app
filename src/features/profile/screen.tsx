import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronRight,
  History,
  LogIn,
  LogOut,
  LucideIcon,
  Pencil,
  User,
} from 'lucide-react-native';
import type { RootNav } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconBox,
  ListSkeleton,
  Text,
} from '../../components/ui';
import { formatarData, formatarReal, rotuloVeiculo } from '../../lib/formato';
import { useConsulta } from '../../lib/useConsulta';
import { useTheme } from '../../theme';
import { primeiroNome, useAuth } from '../auth/AuthProvider';
import { limparCache } from '../carteira/api';
import { buscarEconomia } from '../clube/api';
import { buscarPerfil } from './api';

export function ProfileScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<RootNav>();
  const { user, sair, sairDoModoVisitante } = useAuth();
  const usuarioId = user?.id ?? null;

  const perfil = useConsulta(usuarioId ? `perfil:${usuarioId}` : null, () =>
    buscarPerfil(usuarioId!),
  );
  const economia = useConsulta(usuarioId ? `economia:${usuarioId}` : null, () =>
    buscarEconomia(usuarioId!),
  );

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

  async function onSair() {
    await limparCache();
    await sair();
  }

  const p = perfil.dados;
  const linhas = [
    ['E-mail', p?.email ?? user.email],
    ['Telefone', p?.telefone],
    ['Cidade', [p?.cidade, p?.uf].filter(Boolean).join(' / ')],
    ['Como roda', p?.tipo_veiculo ? rotuloVeiculo[p.tipo_veiculo] : undefined],
    ['Placa', p?.placa],
    ['No CORRE desde', formatarData(p?.criado_em)],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <Screen
      onRefresh={() =>
        Promise.all([perfil.recarregar(true), economia.recarregar(true)])
      }
    >
      <Card padding={20} style={styles.header}>
        <IconBox size={56}>
          <User size={28} color={colors.highlight} />
        </IconBox>
        <View style={styles.flex}>
          <Text variant="h2" numberOfLines={1}>
            {p?.nome || primeiroNome(user)}
          </Text>
          <Text variant="caption" tone="muted">
            Plano {p?.plano === 'premium' ? 'premium' : 'free'}
          </Text>
          {/* TODO(pagamentos): botão "Virar assinante" quando o gateway estiver definido. */}
        </View>
      </Card>

      <Card padding={20}>
        <Text variant="small" tone="muted">
          Você já economizou
        </Text>
        <Text variant="hero" tone="highlight">
          {formatarReal(economia.dados?.total ?? 0)}
        </Text>
      </Card>

      {perfil.carregando ? (
        <ListSkeleton rows={2} />
      ) : perfil.erro && !p ? (
        <ErrorState onRetry={() => perfil.recarregar()} />
      ) : (
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
      )}

      <View style={styles.acoes}>
        <Acao
          icon={Pencil}
          label="Editar meus dados"
          onPress={() => navigation.navigate('EditarPerfil')}
        />
        <Acao
          icon={History}
          label="Histórico de resgates"
          onPress={() => navigation.navigate('Historico')}
        />
      </View>

      <Button
        variant="outline"
        size="lg"
        title="Sair da conta"
        icon={<LogOut size={16} color={colors.foreground} />}
        onPress={onSair}
      />
    </Screen>
  );
}

function Acao({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.acao}>
        <Icon size={20} color={colors.highlight} />
        <Text variant="title" style={styles.flex}>
          {label}
        </Text>
        <ChevronRight size={18} color={colors.mutedForeground} />
      </Card>
    </Pressable>
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
  acoes: { gap: 12 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
