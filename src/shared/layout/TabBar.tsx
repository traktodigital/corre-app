import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import Bike from 'lucide-react-native/icons/bike';
import Gift from 'lucide-react-native/icons/gift';
import Home from 'lucide-react-native/icons/house';
import User from 'lucide-react-native/icons/user';
import Wallet from 'lucide-react-native/icons/wallet';
import { glow, useTheme } from '../theme';
import { Text } from '../ui/Text';

export type TabKey = 'trip' | 'home' | 'benefits' | 'wallet' | 'profile';

export const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'trip', label: 'Entregas', icon: Bike },
  { key: 'home', label: 'Início', icon: Home },
  { key: 'benefits', label: 'Benefícios', icon: Gift },
  { key: 'wallet', label: 'Carteira', icon: Wallet },
  { key: 'profile', label: 'Perfil', icon: User },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: insets.bottom,
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
        },
      ]}
    >
      {tabs.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        const color = isActive ? colors.highlight : colors.mutedForeground;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(key)}
            style={styles.item}
          >
            <View style={isActive ? glow(colors.highlight, 0.8) : undefined}>
              <Icon size={20} color={color} strokeWidth={isActive ? 2.5 : 2} />
            </View>
            <Text
              variant="tiny"
              style={[{ color }, isActive && styles.activeLabel]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10 },
  activeLabel: { fontWeight: '700' },
});
