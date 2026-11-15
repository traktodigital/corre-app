import { ReactNode, useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../theme';

export function Screen({
  children,
  scroll = true,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;

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
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingTop: 20, paddingBottom: 32 },
  content: { width: '100%', alignSelf: 'center' },
});
