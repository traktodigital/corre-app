import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronRight,
  ClipboardCheck,
  Gift,
  IdCard,
  LucideIcon,
  Store,
} from 'lucide-react-native';

import type { RootNav } from '../../../app/navigation';
import { Screen, TabKey } from '../../../shared/layout';
import {
  Card,
  EmptyState,
  IconBox,
  ListSkeleton,
  SectionTitle,
  Text,
} from '../../../shared/ui';
import { formatCurrency } from '../../../shared/format';
import { useQuery } from '../../../shared/hooks/useQuery';
import { alpha, palette, useTheme } from '../../../shared/theme';
import { firstName, useSession } from '../../auth';
import {
  fetchSavings,
  listFeaturedOffers,
  listPartners,
  OfferCard,
  PartnerCard,
} from '../../club';

const shortcuts: { label: string; icon: LucideIcon; tab: TabKey }[] = [
  { label: 'Benefícios', icon: Gift, tab: 'benefits' },
  { label: 'Carteirinha', icon: IdCard, tab: 'wallet' },
];

export function HomeScreen({
  onSelectTab,
}: {
  onSelectTab: (tab: TabKey) => void;
}) {
  const { colors, radius } = useTheme();
  const navigation = useNavigation<RootNav>();
  const { user, managedAssociationIds } = useSession();
  const userId = user?.id ?? null;

  const savings = useQuery(userId ? `savings:${userId}` : null, () =>
    fetchSavings(userId!),
  );
  const offers = useQuery('featured-offers', listFeaturedOffers);
  const partners = useQuery('partners', listPartners);

  return (
    <Screen
      onRefresh={() =>
        Promise.all([
          savings.reload(true),
          offers.reload(true),
          partners.reload(true),
        ])
      }
    >
      <Card padding={20} glowing>
        <Text variant="h1">Olá, {firstName(user)}!</Text>
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
            {formatCurrency(savings.data?.total ?? 0)}
          </Text>
          <Text variant="caption" tone="muted" style={styles.mt1}>
            {user
              ? 'Soma dos descontos já validados no balcão'
              : 'Crie sua conta pra começar a somar seus descontos'}
          </Text>
        </View>
      </Card>

      {managedAssociationIds.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('MembershipRequestsAdmin')}
        >
          <Card style={styles.row}>
            <IconBox>
              <ClipboardCheck size={20} color={colors.highlight} />
            </IconBox>
            <View style={styles.flex}>
              <Text variant="title">Pedidos de filiação</Text>
              <Text variant="caption" tone="muted">
                Revise os pedidos da sua associação
              </Text>
            </View>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Card>
        </Pressable>
      ) : null}

      <View>
        <SectionTitle hint="acesso rápido">Bora começar</SectionTitle>
        <View style={styles.grid}>
          {shortcuts.map(({ label, icon: Icon, tab }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() => onSelectTab(tab)}
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
        {offers.loading ? (
          <ListSkeleton rows={2} />
        ) : (offers.data ?? []).length === 0 ? (
          <EmptyState
            icon={Store}
            title="Ofertas chegando"
            description="Os parceiros do clube publicam os descontos aqui."
          />
        ) : (
          <View style={styles.list}>
            {offers.data!.map(o => (
              <OfferCard
                key={o.id}
                offer={o}
                onPress={() => navigation.navigate('Offer', { id: o.id })}
              />
            ))}
          </View>
        )}
      </View>

      <View>
        <SectionTitle hint="mais bem avaliados">Parceiros</SectionTitle>
        {partners.loading ? (
          <ListSkeleton rows={2} />
        ) : (partners.data ?? []).length === 0 ? null : (
          <View style={styles.list}>
            {partners.data!.slice(0, 3).map(p => (
              <PartnerCard
                key={p.id}
                partner={p}
                onPress={() => navigation.navigate('Partner', { id: p.id })}
              />
            ))}
          </View>
        )}
      </View>
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
});
