import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Logo } from './Logo';

/** Header fixo do AppShell web: logo à esquerda, sino com ponto neon. */
export function AppHeader({
  onPressNotifications,
  hasUnread = true,
}: {
  onPressNotifications?: () => void;
  hasUnread?: boolean;
}) {
  const { colors, radius, layout } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 12,
          paddingHorizontal: layout.screenPadding,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Logo />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Avisos"
        onPress={onPressNotifications}
        style={[
          styles.bell,
          {
            borderRadius: radius.md,
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Bell size={20} color={colors.foreground} />
        {hasUnread ? (
          <View style={[styles.dot, { backgroundColor: colors.highlight }]} />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  bell: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
