import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';

/** <main className="px-4 pt-5 space-y-8"> do AppShell web. */
export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const { colors, layout } = useTheme();
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
