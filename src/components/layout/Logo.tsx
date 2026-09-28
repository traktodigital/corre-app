import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';

const simbolo = require('../../assets/corre-simbolo.png');

/**
 * Logo CORRE. O web usa a arte horizontal hospedada no Lovable; aqui
 * montamos símbolo + nome até a arte horizontal ser adicionada ao projeto.
 */
export function Logo({
  size = 32,
  showName = true,
}: {
  size?: number;
  showName?: boolean;
}) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel="CORRE — Clube do Entregador"
    >
      <Image
        source={simbolo}
        style={{ width: size, height: size, borderRadius: size * 0.3 }}
        resizeMode="contain"
      />
      {showName ? (
        <View>
          <Text variant="h3" style={styles.name}>
            CORRE
          </Text>
          <Text variant="micro" tone="muted" style={styles.tagline}>
            CLUBE DO ENTREGADOR
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { lineHeight: 18 },
  tagline: { letterSpacing: 1, fontWeight: '600', fontSize: 8 },
});
