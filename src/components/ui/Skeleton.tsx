import { useEffect, useRef } from 'react';
import {
  Animated,
  DimensionValue,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { alpha, useTheme } from '../../theme';
import { Card } from './Card';

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: alpha(colors.foreground, 0.1),
          opacity,
        },
        style,
      ]}
    />
  );
}

/** ListSkeleton do web: linhas com quadrado + duas barras. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} style={styles.row}>
          <Skeleton width={44} height={44} radius={12} />
          <View style={styles.lines}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="60%" height={12} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lines: { flex: 1, gap: 8 },
});
