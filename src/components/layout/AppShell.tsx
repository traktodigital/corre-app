import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { AppHeader } from './AppHeader';
import { TabBar, TabKey } from './TabBar';

/**
 * Estrutura do app do entregador: header, conteúdo e tab bar.
 * A navegação real (react-navigation) entra na etapa de fluxos.
 */
export function AppShell({
  activeTab,
  onChangeTab,
  children,
}: {
  activeTab: TabKey;
  onChangeTab: (tab: TabKey) => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppHeader />
      <View style={styles.root}>{children}</View>
      <TabBar active={activeTab} onChange={onChangeTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
