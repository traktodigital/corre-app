import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, Star } from 'lucide-react-native';
import { Card, Text } from '../../../../shared/ui';
import { useTheme } from '../../../../shared/theme';
import type { PartnerSummary } from '../../domain';
import { PartnerLogo } from './PartnerLogo';

export function PartnerCard({
  partner,
  onPress,
}: {
  partner: PartnerSummary;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const location = [partner.neighborhood, partner.city]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Parceiro ${partner.name}`}
      onPress={onPress}
    >
      <Card style={styles.row}>
        <PartnerLogo url={partner.logoUrl} />
        <View style={styles.flex}>
          <Text variant="title" numberOfLines={1}>
            {partner.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[partner.category?.name, location].filter(Boolean).join(' · ') ||
              'Parceiro Sou Corre'}
          </Text>
        </View>
        {partner.rating ? (
          <View style={styles.rating}>
            <Star size={12} color={colors.mutedForeground} />
            <Text variant="tiny" tone="muted">
              {partner.rating.toFixed(1)}
            </Text>
          </View>
        ) : null}
        <ChevronRight size={18} color={colors.mutedForeground} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
