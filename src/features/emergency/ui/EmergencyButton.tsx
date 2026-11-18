import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { palette } from '../../../shared/theme';
import { Text } from '../../../shared/ui';
import { HOLD_TO_TRIGGER_MS } from '../domain';

const SIZE = 64;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const HIDDEN_ON = new Set([
  'Emergency',
  'EmergencyContact',
  'Accident',
  'AccidentForm',
  'AccidentConsent',
  'ThreeB',
]);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setVisible(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

export function EmergencyButton({
  routeName,
  onTrigger,
}: {
  routeName: string | undefined;
  onTrigger: () => void;
}) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);

  const trigger = useCallback(() => {
    Vibration.vibrate([0, 250, 120, 250]);
    onTrigger();
  }, [onTrigger]);

  function pressIn() {
    setHolding(true);
    Vibration.vibrate(40);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_TO_TRIGGER_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      progress.setValue(0);
      setHolding(false);
      if (finished) {
        trigger();
      }
    });
  }

  function pressOut() {
    progress.stopAnimation();
  }

  if (!routeName || HIDDEN_ON.has(routeName) || keyboardVisible) {
    return null;
  }

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: insets.bottom + (routeName === 'Main' ? 96 : 24) },
      ]}
    >
      {holding ? (
        <View style={styles.hint}>
          <Text variant="small" style={styles.hintText}>
            Segura 3 segundos
          </Text>
        </View>
      ) : null}
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel="Emergência. Segure por 3 segundos para pedir ajuda."
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'activate') {
            trigger();
          }
        }}
        style={styles.button}
      >
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#ffffff"
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            rotation={-90}
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <Text style={styles.label}>SOS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    gap: 8,
  },
  hint: {
    backgroundColor: palette.danger,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hintText: { color: '#ffffff', fontWeight: '700' },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  label: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
});
