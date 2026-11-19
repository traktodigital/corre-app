import { Image } from 'react-native';
import Store from 'lucide-react-native/icons/store';
import { IconBox } from '../../../../shared/ui';
import { useTheme } from '../../../../shared/theme';

export function PartnerLogo({
  url,
  size = 44,
}: {
  url: string | null | undefined;
  size?: number;
}) {
  const { colors, radius } = useTheme();
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        accessibilityIgnoresInvertColors
        style={{
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: colors.muted,
        }}
      />
    );
  }
  return (
    <IconBox size={size}>
      <Store size={size / 2.2} color={colors.highlight} />
    </IconBox>
  );
}
