import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { artwork } from '@/brand/artwork';
import { useTheme } from '@/theme';

export type ArtKind = keyof typeof artwork.light;

/** Local SVG paths, with no bitmap embedding or runtime network requests. */
export const BrandArt = memo(function BrandArt({
  kind = 'mark',
  width = '100%',
  height = 180,
  style,
}: {
  kind?: ArtKind;
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { dark } = useTheme();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, alignSelf: 'center' }, style]}
    >
      <SvgXml xml={artwork[dark ? 'dark' : 'light'][kind]} width="100%" height="100%" />
    </View>
  );
});
