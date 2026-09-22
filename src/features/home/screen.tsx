import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bem-vindo ao CorreApp!</Text>
      <Text>Safe Area Insets:</Text>
      <Text>Top: {safeAreaInsets.top}</Text>
      <Text>Bottom: {safeAreaInsets.bottom}</Text>
      <Text>Left: {safeAreaInsets.left}</Text>
      <Text>Right: {safeAreaInsets.right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    margin: 16,
  },
});
