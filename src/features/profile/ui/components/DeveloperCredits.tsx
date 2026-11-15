import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../../shared/ui';

export function DeveloperCredits() {
  return (
    <View style={styles.credits}>
      <Text variant="caption" tone="muted">
        Desenvolvido por
      </Text>
      <View style={styles.links}>
        <CreditLink
          name="Trakto Digital"
          url="https://www.traktodigital.com.br/"
        />
        <Text variant="caption" tone="muted">
          ·
        </Text>
        <CreditLink name="Almexa" url="https://almexa.com.br/" />
      </View>
    </View>
  );
}

function CreditLink({ name, url }: { name: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir site da ${name}`}
      hitSlop={8}
      onPress={() => Linking.openURL(url)}
    >
      <Text variant="caption" tone="highlight" style={styles.name}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  credits: { alignItems: 'center', gap: 4, paddingTop: 8 },
  links: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontWeight: '600' },
});
