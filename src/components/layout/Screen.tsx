import { ReactNode, useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';

/** <main className="px-4 pt-5 space-y-8"> do AppShell web. */
export function Screen({
  children,
  scroll = true,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Liga o "puxar pra atualizar". */
  onRefresh?: () => Promise<unknown> | void;
}) {
  const { colors, layout } = useTheme();
  const [atualizando, setAtualizando] = useState(false);
  const puxou = useCallback(async () => {
    if (!onRefresh) {
      return;
    }
    setAtualizando(true);
    try {
      await onRefresh();
    } finally {
      setAtualizando(false);
    }
  }, [onRefresh]);
  const content = (
    <View
      style={[
        styles.content,
        { gap: layout.sectionGap, maxWidth: layout.maxWidth },
      ]}
    >
      {children}
    </View>
  );

  if (!scroll) {
    return (
      <View
        style={[
          styles.flex,
          { backgroundColor: colors.background, padding: layout.screenPadding },
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={atualizando}
            onRefresh={puxou}
            tintColor={colors.highlight}
            colors={[colors.primary]}
          />
        ) : undefined
      }
      contentContainerStyle={[
        styles.scroll,
        { paddingHorizontal: layout.screenPadding },
      ]}
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingTop: 20, paddingBottom: 32 },
  content: { width: '100%', alignSelf: 'center' },
});
