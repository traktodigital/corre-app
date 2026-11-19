import { Linking, StyleSheet, View } from 'react-native';
import Clock from 'lucide-react-native/icons/clock';
import MapPin from 'lucide-react-native/icons/map-pin';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Store from 'lucide-react-native/icons/store';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SectionTitle,
  Text,
} from '../../../../shared/ui';
import { onlyDigits } from '../../../../shared/format';
import { STALE, useQuery } from '../../../../shared/hooks/useQuery';
import { useTheme } from '../../../../shared/theme';
import { fetchPartner, listPartnerOffers } from '../../data/clubRepository';
import { OfferCard } from '../components/OfferCard';
import { PartnerLogo } from '../components/PartnerLogo';

export function PartnerScreen({ route, navigation }: ScreenProps<'Partner'>) {
  const { id } = route.params;
  const { colors } = useTheme();
  const partner = useQuery(`partner:${id}`, () => fetchPartner(id), {
    staleMs: STALE.catalog,
  });
  const offers = useQuery(`partner-offers:${id}`, () => listPartnerOffers(id), {
    staleMs: STALE.catalog,
  });

  if (partner.loading) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (partner.error && partner.data === undefined) {
    return (
      <Screen>
        <ErrorState onRetry={() => partner.reload()} />
      </Screen>
    );
  }
  const p = partner.data;
  if (!p) {
    return (
      <Screen>
        <EmptyState
          icon={Store}
          title="Parceiro fora do ar"
          description="Esse parceiro não está mais no clube. Dá uma olhada nos outros."
          action={<Button title="Voltar" onPress={() => navigation.goBack()} />}
        />
      </Screen>
    );
  }

  const address = [p.address, p.neighborhood, p.city, p.state]
    .filter(Boolean)
    .join(', ');
  const whatsapp = onlyDigits(p.whatsapp ?? '');

  return (
    <Screen
      onRefresh={() => Promise.all([partner.reload(true), offers.reload(true)])}
    >
      <Card padding={20} style={styles.header}>
        <PartnerLogo url={p.logoUrl} size={64} />
        <View style={styles.flex}>
          <Text variant="h2">{p.name}</Text>
          {p.category ? (
            <Text variant="caption" tone="highlight">
              {p.category.name}
            </Text>
          ) : null}
        </View>
      </Card>

      {p.description ? (
        <Text variant="small" tone="muted">
          {p.description}
        </Text>
      ) : null}

      {address || p.openingHours ? (
        <Card style={styles.infos}>
          {address ? (
            <View style={styles.info}>
              <MapPin size={16} color={colors.highlight} />
              <Text variant="small" style={styles.flex}>
                {address}
              </Text>
            </View>
          ) : null}
          {p.openingHours ? (
            <View style={styles.info}>
              <Clock size={16} color={colors.highlight} />
              <Text variant="small" style={styles.flex}>
                {p.openingHours}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {whatsapp ? (
        <Button
          variant="outline"
          title="Chamar no WhatsApp"
          icon={<MessageCircle size={16} color={colors.foreground} />}
          onPress={() =>
            Linking.openURL(
              `https://wa.me/${
                whatsapp.length <= 11 ? `55${whatsapp}` : whatsapp
              }`,
            )
          }
        />
      ) : null}

      <View>
        <SectionTitle hint="toque pra resgatar">Ofertas</SectionTitle>
        {offers.loading ? (
          <ListSkeleton rows={2} />
        ) : offers.error && !offers.data ? (
          <ErrorState onRetry={() => offers.reload()} />
        ) : (offers.data ?? []).length === 0 ? (
          <EmptyState
            icon={Store}
            title="Sem oferta no ar"
            description="Esse parceiro ainda não publicou desconto. Volta depois."
          />
        ) : (
          <View style={styles.list}>
            {offers.data!.map(o => (
              <OfferCard
                key={o.id}
                offer={o}
                partnerName={p.name}
                onPress={() => navigation.navigate('Offer', { id: o.id })}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1 },
  infos: { gap: 12 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  list: { gap: 12 },
});
