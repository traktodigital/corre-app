import { StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useTheme } from '../../../../shared/theme';
import { drawRoute, type RoutePoint } from '../../domain';

const GRID = 34;
const AVENUE_EVERY = 4;
const GRID_ANGLE = -22;
const MAP_BASE = { dark: '#16202a', light: '#dde4ea' } as const;

export function RouteMap({
  points,
  width,
  height,
  routeTop,
  routeBottom,
}: {
  points: RoutePoint[];
  width: number;
  height: number;
  routeTop: number;
  routeBottom: number;
}) {
  const { colors, mode } = useTheme();
  const route = drawRoute(points, width, routeBottom - routeTop, 28);
  const cx = width / 2;
  const cy = height / 2;
  const reach = Math.hypot(width, height);
  const lines = Math.ceil(reach / GRID);
  const offsets = Array.from({ length: lines * 2 + 1 }, (_, i) => i - lines);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.35" stopColor={colors.background} stopOpacity="0" />
          <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="fadeTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.background} stopOpacity="0.7" />
          <Stop offset="0.18" stopColor={colors.background} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill={MAP_BASE[mode]} />
      <G
        rotation={GRID_ANGLE}
        origin={`${cx}, ${cy}`}
        stroke={colors.foreground}
      >
        {offsets.map(i => {
          const avenue = i % AVENUE_EVERY === 0;
          const props = {
            strokeWidth: avenue ? 3 : 1,
            strokeOpacity: avenue ? 0.09 : 0.05,
          };
          return [
            <Line
              key={`v${i}`}
              x1={cx + i * GRID}
              y1={cy - reach}
              x2={cx + i * GRID}
              y2={cy + reach}
              {...props}
            />,
            <Line
              key={`h${i}`}
              x1={cx - reach}
              y1={cy + i * GRID}
              x2={cx + reach}
              y2={cy + i * GRID}
              {...props}
            />,
          ];
        })}
      </G>
      {route ? (
        <G y={routeTop}>
          <Path
            d={route.d}
            stroke={colors.highlight}
            strokeOpacity={0.22}
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d={route.d}
            stroke={colors.highlight}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Circle
            cx={route.start[0]}
            cy={route.start[1]}
            r={6}
            fill={MAP_BASE[mode]}
            stroke={colors.highlight}
            strokeWidth={3}
          />
          <Circle
            cx={route.end[0]}
            cy={route.end[1]}
            r={11}
            fill={colors.highlight}
          />
          <Circle
            cx={route.end[0]}
            cy={route.end[1]}
            r={4}
            fill={MAP_BASE[mode]}
          />
        </G>
      ) : null}
      <Rect width={width} height={height} fill="url(#fadeTop)" />
      <Rect width={width} height={height} fill="url(#fadeBottom)" />
    </Svg>
  );
}
