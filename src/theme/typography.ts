import type { TextStyle } from 'react-native';
export const typography: Record<
  'largeTitle' | 'title' | 'headline' | 'body' | 'caption',
  TextStyle
> = {
  largeTitle: { fontSize: 36, lineHeight: 44, fontWeight: '700', letterSpacing: -1.2 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '600', letterSpacing: -0.5 },
  headline: { fontSize: 19, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
};
