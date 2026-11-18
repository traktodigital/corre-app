import { Image, Linking, StyleSheet, View } from 'react-native';
import { ExternalLink, MapPinned, Quote } from 'lucide-react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import { useTheme } from '../../../../shared/theme';
import { Button, Card, Text } from '../../../../shared/ui';
import { THREE_B } from '../../domain';

const logo = require('../../../../assets/partners/3b-logo.png');

const LINKS = [
  { label: 'Site', url: THREE_B.site },
  { label: 'Instagram', url: THREE_B.instagram },
  { label: 'YouTube', url: THREE_B.youtube },
  { label: 'TikTok', url: THREE_B.tiktok },
] as const;

export function ThreeBScreen({ navigation }: ScreenProps<'ThreeB'>) {
  const { colors } = useTheme();

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.logoBox}>
          <Image
            source={logo}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Logo da 3B Indenizações"
          />
        </View>

        <Text>{THREE_B.description}</Text>

        <Button
          title="Saber meus direitos"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('AccidentForm')}
        />

        <View style={styles.block}>
          <Text variant="h2">Quem já foi atendido</Text>
          {THREE_B.testimonials.map(item => (
            <Card key={item.author} style={styles.quote}>
              <Quote size={18} color={colors.highlight} />
              <Text>{item.text}</Text>
              <Text variant="small" tone="muted">
                {item.author}
              </Text>
            </Card>
          ))}
        </View>

        <View style={styles.block}>
          <Text variant="h2">Onde encontrar</Text>
          <View style={styles.row}>
            <MapPinned size={18} color={colors.highlight} />
            <Text style={styles.flex}>{THREE_B.address}</Text>
          </View>
          <Text variant="small" tone="muted">
            {THREE_B.hours}
          </Text>
          <View style={styles.links}>
            {LINKS.map(link => (
              <Button
                key={link.label}
                title={link.label}
                variant="outline"
                size="sm"
                icon={<ExternalLink size={16} color={colors.foreground} />}
                onPress={() => Linking.openURL(link.url).catch(() => {})}
              />
            ))}
          </View>
        </View>

        <Text variant="small" tone="muted">
          A 3B não é seguro e não substitui o 192 nem o 193.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20 },
  logoBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logo: { width: '100%', height: 72 },
  block: { gap: 12 },
  quote: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
