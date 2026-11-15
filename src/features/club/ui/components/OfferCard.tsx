import { Pressable, StyleSheet, View } from 'react-native';
import { Store } from 'lucide-react-native';
import { Badge, Card, IconBox, Text } from '../../../../shared/ui';
import { useTheme } from '../../../../shared/theme';
import { discountSummary, type Offer } from '../../domain';

export function OfferCard({
  offer,
  partnerName,
  onPress,
}: {
  offer: Offer;
  partnerName?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const discount = discountSummary(offer);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Oferta ${offer.title}`}
      onPress={onPress}
    >
      <Card style={styles.row}>
        <IconBox>
          <Store size={20} color={colors.highlight} />
        </IconBox>
        <View style={styles.flex}>
          <Text variant="title" numberOfLines={2}>
            {offer.title}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[discount, partnerName ?? offer.partner?.name]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {offer.membersOnly ? (
          <Badge status="associado" label="Associado" />
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
});
