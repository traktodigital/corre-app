import { Pressable, StyleSheet } from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { Card, Text } from '../../../../shared/ui';
import { useTheme } from '../../../../shared/theme';

export function ProfileAction({
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
      <Card style={styles.action}>
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
  action: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
