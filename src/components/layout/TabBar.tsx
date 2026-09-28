import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Gift,
  Home,
  LucideIcon,
  Package,
  User,
  Wallet,
} from 'lucide-react-native';
import { glow, useTheme } from '../../theme';
import { Text } from '../ui/Text';

export type TabKey =
  | 'inicio'
  | 'entregas'
  | 'beneficios'
  | 'carteira'
  | 'perfil';

export const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'inicio', label: 'Início', icon: Home },
  { key: 'entregas', label: 'Entregas', icon: Package },
  { key: 'beneficios', label: 'Benefícios', icon: Gift },
  { key: 'carteira', label: 'Carteira', icon: Wallet },
  { key: 'perfil', label: 'Perfil', icon: User },
];

/** Barra inferior do AppShell web: ativo em neon com brilho. */
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
