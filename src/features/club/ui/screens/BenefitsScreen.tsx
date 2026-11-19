import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Search from 'lucide-react-native/icons/search';
import Store from 'lucide-react-native/icons/store';
import type { RootNav } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SectionTitle,
  Text,
} from '../../../../shared/ui';
import { STALE, useQuery } from '../../../../shared/hooks/useQuery';
import { alpha, palette, useTheme } from '../../../../shared/theme';
import {
  listCategories,
  listFeaturedOffers,
  listPartners,
} from '../../data/clubRepository';
import { OfferCard } from '../components/OfferCard';
import { PartnerCard } from '../components/PartnerCard';

const ALL = 'all';

const PAGE_SIZE = 20;

export function BenefitsScreen() {
  const navigation = useNavigation<RootNav>();
  const { colors, radius } = useTheme();
  const [category, setCategory] = useState(ALL);
  const [search, setSearch] = useState('');

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const categories = useQuery('categories', listCategories, {
    staleMs: STALE.reference,
  });
  const partners = useQuery('partners', listPartners, {
    staleMs: STALE.catalog,
  });
  const featured = useQuery('featured-offers', listFeaturedOffers, {
    staleMs: STALE.catalog,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (partners.data ?? []).filter(
      p =>
        (category === ALL || p.category?.id === category) &&
        (!term || p.name.toLowerCase().includes(term)),
    );
  }, [partners.data, category, search]);

  const filtering = search.trim() !== '' || category !== ALL;

  const reload = () =>
    Promise.all([
      categories.reload(true),
      partners.reload(true),
      featured.reload(true),
    ]);

  return (
    <Screen onRefresh={reload}>
      <View>
        <Text variant="h1">Benefícios</Text>
        <Text variant="small" tone="muted">
          Escolha o parceiro, gere o código e mostre no balcão.
        </Text>
      </View>

      {(featured.data ?? []).length > 0 ? (
        <View>
          <SectionTitle hint="ofertas do clube">Em destaque</SectionTitle>
          <View style={styles.list}>
            {featured.data!.map(o => (
              <OfferCard
                key={o.id}
                offer={o}
                onPress={() => navigation.navigate('Offer', { id: o.id })}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.gap}>
        <SectionTitle
          hint={partners.data ? `${filtered.length} no ar` : undefined}
        >
          Parceiros
        </SectionTitle>

        <View
          style={[
            styles.search,
            {
              borderRadius: radius.md,
              borderColor: colors.input,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Search size={18} color={colors.mutedForeground} />
          <TextInput
            accessibilityLabel="Buscar parceiro"
            placeholder="Buscar parceiro"
            placeholderTextColor={colors.mutedForeground}
            selectionColor={colors.highlight}
            value={search}
            onChangeText={t => {
              setSearch(t);
              setVisibleCount(PAGE_SIZE);
            }}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>

        {(categories.data ?? []).length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pills}
          >
            {[{ id: ALL, name: 'Todas' }, ...categories.data!].map(c => {
              const active = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setCategory(c.id);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  style={[
                    styles.pill,
                    { borderRadius: radius.full },
                    active
                      ? {
                          borderColor: colors.highlight,
                          backgroundColor: alpha(palette.green, 0.15),
                        }
                      : {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                  ]}
                >
                  <Text
                    variant="caption"
                    tone={active ? 'highlight' : 'default'}
                    style={styles.bold}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {partners.loading ? (
          <ListSkeleton rows={4} />
        ) : partners.error && !partners.data ? (
          <ErrorState onRetry={() => partners.reload()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Store}
            title={filtering ? 'Nada por aqui' : 'Parceiros chegando'}
            description={
              filtering
                ? 'Tenta outra categoria ou outro nome.'
                : 'Os primeiros parceiros entram no ar no lançamento. Volta já já.'
            }
          />
        ) : (
          <View style={styles.list}>
            {filtered.slice(0, visibleCount).map(p => (
              <PartnerCard
                key={p.id}
                partner={p}
                onPress={() => navigation.navigate('Partner', { id: p.id })}
              />
            ))}
            {filtered.length > visibleCount ? (
              <Button
                title={`Carregar mais (${filtered.length - visibleCount})`}
                variant="outline"
                onPress={() => setVisibleCount(v => v + PAGE_SIZE)}
              />
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  gap: { gap: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 16, height: '100%' },
  pills: { gap: 8 },
  pill: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  bold: { fontWeight: '700' },
});
