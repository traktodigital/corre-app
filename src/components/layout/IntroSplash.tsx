import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import { alpha, palette } from '../../theme';
import { Text } from '../ui/Text';

const simbolo = require('../../assets/corre-simbolo.png');

/** Mesmo fundo do símbolo e do splash nativo — a troca fica invisível. */
export const SPLASH_BG = '#0a120b';

const LOGO = 180;
// Curva do site (cubic-bezier(0.16, 1, 0.3, 1)).
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Animação de entrada: o símbolo cresce com brilho neon, o nome sobe,
 * a linha esmeralda corre e a tela some revelando o app.
 */
export function IntroSplash({ onFinish }: { onFinish: () => void }) {
  const logo = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const name = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduceMotion => {
        if (cancelled) {
          return;
        }
        if (reduceMotion) {
          logo.setValue(1);
          name.setValue(1);
          line.setValue(1);
          Animated.timing(exit, {
            toValue: 1,
            duration: 300,
            delay: 600,
            useNativeDriver: true,
          }).start(() => onFinish());
          return;
        }

        Animated.sequence([
          Animated.parallel([
            Animated.spring(logo, {
              toValue: 1,
              friction: 6,
              tension: 60,
              useNativeDriver: true,
            }),
            Animated.timing(pulse, {
              toValue: 1,
              duration: 1100,
              delay: 150,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(name, {
              toValue: 1,
              duration: 700,
              delay: 350,
              easing: easeOut,
              useNativeDriver: true,
            }),
            Animated.timing(line, {
              toValue: 1,
              duration: 900,
              delay: 550,
              easing: easeOut,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(250),
          Animated.timing(exit, {
            toValue: 1,
            duration: 450,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => onFinish());
      });

    return () => {
      cancelled = true;
    };
  }, [exit, line, logo, name, onFinish, pulse]);

  const logoStyle = {
    opacity: logo.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0, 1, 1],
    }),
    transform: [
      {
        scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
      },
      {
        rotate: logo.interpolate({
          inputRange: [0, 1],
          outputRange: ['-25deg', '0deg'],
        }),
      },
    ],
  };

  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0, 0.55, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.6, 1.9],
        }),
      },
    ],
  };

  const nameStyle = {
    opacity: name,
    transform: [
      {
        translateY: name.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  const containerStyle = {
    opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [
      {
        scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
      },
    ],
  };

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel="CORRE — Clube do Entregador"
      style={[StyleSheet.absoluteFill, styles.root, containerStyle]}
    >
      <View style={styles.center}>
        <Animated.View style={[styles.pulse, pulseStyle]} />
        <Animated.View style={[styles.glow, logoStyle]}>
          <Image source={simbolo} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      </View>

      <Animated.View style={[styles.brand, nameStyle]}>
        <Text variant="hero" style={styles.name}>
          CORRE
        </Text>
        <Text variant="micro" tone="muted" style={styles.tagline}>
          CLUBE DO ENTREGADOR
        </Text>
      </Animated.View>

      <View style={styles.lineTrack}>
        <Animated.View
          style={[styles.line, { transform: [{ scaleX: line }] }]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BG,
  },
  center: {
    width: LOGO,
    height: LOGO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    borderWidth: 2,
    borderColor: palette.neon,
    backgroundColor: alpha(palette.neon, 0.08),
  },
  glow: {
    shadowColor: palette.neon,
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  logo: { width: LOGO, height: LOGO, borderRadius: LOGO * 0.22 },
  brand: { marginTop: 20, alignItems: 'center' },
  name: { letterSpacing: 4 },
  tagline: { marginTop: 4, letterSpacing: 3 },
  lineTrack: { marginTop: 18, width: 140, height: 2, overflow: 'hidden' },
  line: { flex: 1, backgroundColor: palette.neon, borderRadius: 1 },
});
