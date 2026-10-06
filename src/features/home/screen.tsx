import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Gift, IdCard, LucideIcon, Store } from 'lucide-react-native';
// import { Trophy } from 'lucide-react-native'; // volta junto com o card de nível
import type { RootNav } from '../../app/navigation';
import { Screen, TabKey } from '../../components/layout';
import {
  Card,
  EmptyState,
  // IconBox, // volta junto com o card de nível
  ListSkeleton,
  // ProgressBar, // volta junto com o card de nível
  SectionTitle,
  Text,
} from '../../components/ui';
import { formatarReal } from '../../lib/formato';
import { useConsulta } from '../../lib/useConsulta';
import { alpha, palette, useTheme } from '../../theme';
import { primeiroNome, useAuth } from '../auth/AuthProvider';
import {
  buscarEconomia,
  listarOfertasDestaque,
  listarParceiros,
} from '../clube/api';
import { CardOferta, CardParceiro } from '../clube/components';

// FORA DA FASE 1: meta do mês para a barra de nível (mesmo texto do web).
// const META_MES = 5;

const atalhos: { label: string; icon: LucideIcon; tab: TabKey }[] = [
  { label: 'Benefícios', icon: Gift, tab: 'beneficios' },
  { label: 'Carteirinha', icon: IdCard, tab: 'carteira' },
  // TODO(fase-2): Formação (cursos) e Casa própria — dependem de parceria externa.
];

export function HomeScreen({ onIrPara }: { onIrPara: (tab: TabKey) => void }) {
  const { colors, radius } = useTheme();
  const navigation = useNavigation<RootNav>();
  const { user } = useAuth();
  const usuarioId = user?.id ?? null;

  const economia = useConsulta(usuarioId ? `economia:${usuarioId}` : null, () =>
    buscarEconomia(usuarioId!),
  );
  const ofertas = useConsulta('ofertas-destaque', listarOfertasDestaque);
  const parceiros = useConsulta('parceiros', listarParceiros);

  // FORA DA FASE 1: card de nível.
  // const noMes = economia.dados?.validadosNoMes ?? 0;
  // const bateuMeta = noMes >= META_MES;

  return (
    <Screen
      onRefresh={() =>
        Promise.all([
          economia.recarregar(true),
          ofertas.recarregar(true),
          parceiros.recarregar(true),
        ])
      }
    >
      <Card padding={20} glowing>
        <Text variant="h1">Olá, {primeiroNome(user)}!</Text>
        <Text variant="small" tone="muted">
          Bom corre hoje. Bora economizar?
        </Text>

        <View
          style={[
            styles.savings,
            {
              borderRadius: radius['2xl'],
              backgroundColor: alpha(palette.black, 0.6),
            },
          ]}
        >
          <Text variant="small" tone="muted">
            Você já economizou
          </Text>
          <Text variant="hero" tone="highlight">
            {formatarReal(economia.dados?.total ?? 0)}
          </Text>
          <Text variant="caption" tone="muted" style={styles.mt1}>
            {user
              ? 'Soma dos descontos já validados no balcão'
              : 'Crie sua conta pra começar a somar seus descontos'}
          </Text>
        </View>
      </Card>

      {/*
        FORA DA FASE 1: nível/meta do mês — regra de produto ainda não definida.
        {user ? (
          <Card padding={20}>
            <View style={styles.row}>
              <IconBox size={40}>
                <Trophy size={20} color={colors.highlight} />
              </IconBox>
              <View style={styles.flex}>
                <Text variant="h3">
                  {bateuMeta ? 'Meta do mês batida!' : 'Nível Bronze'}
                </Text>
                <Text variant="caption" tone="muted">
                  {noMes} de {META_MES} benefícios usados neste mês
                </Text>
              </View>
            </View>
            <View style={styles.mt4}>
              <ProgressBar value={Math.min(100, (noMes / META_MES) * 100)} />
            </View>
            TODO(produto): regra de níveis (Bronze/Prata/Ouro) e o que cada um libera.
          </Card>
        ) : null}
      */}

      <View>
        <SectionTitle hint="acesso rápido">Bora começar</SectionTitle>
        <View style={styles.grid}>
          {atalhos.map(({ label, icon: Icon, tab }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() => onIrPara(tab)}
              style={[
                styles.shortcut,
                {
                  borderRadius: radius['2xl'],
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Icon size={20} color={colors.highlight} />
              <Text variant="tiny" style={styles.center} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <SectionTitle hint="ofertas do clube">Ofertas em destaque</SectionTitle>
        {ofertas.carregando ? (
          <ListSkeleton rows={2} />
        ) : (ofertas.dados ?? []).length === 0 ? (
          <EmptyState
            icon={Store}
            title="Ofertas chegando"
            description="Os parceiros do clube publicam os descontos aqui."
          />
        ) : (
          <View style={styles.list}>
            {ofertas.dados!.map(o => (
              <CardOferta
                key={o.id}
                oferta={o}
                onPress={() => navigation.navigate('Oferta', { id: o.id })}
              />
            ))}
          </View>
        )}
      </View>

      <View>
        <SectionTitle hint="mais bem avaliados">Parceiros</SectionTitle>
        {parceiros.carregando ? (
          <ListSkeleton rows={2} />
        ) : (parceiros.dados ?? []).length === 0 ? null : (
          <View style={styles.list}>
            {parceiros.dados!.slice(0, 3).map(p => (
              <CardParceiro
                key={p.id}
                parceiro={p}
                onPress={() => navigation.navigate('Parceiro', { id: p.id })}
              />
            ))}
          </View>
        )}
        {/* TODO(fase-2): "Perto de você" ordenado por distância (geolocalização). */}
      </View>

      {/* TODO(fase-2): card "Próximo evento" (tabela `eventos` da associação). */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  savings: { marginTop: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', gap: 12 },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 16,
  },
  list: { gap: 12 },
  center: { textAlign: 'center' },
  mt1: { marginTop: 4 },
  mt4: { marginTop: 16 },
});
