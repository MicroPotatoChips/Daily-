import {
  Droplets,
  Activity,
  BookOpen,
  Flower2,
  PersonStanding,
  Moon,
  Apple,
  Heart,
  Sun,
  Coffee,
  GraduationCap,
  Leaf,
} from 'lucide-react-native';
import { useTheme } from '@/theme';
import type { IconName } from '@/types';
export const iconMap = {
  droplets: Droplets,
  activity: Activity,
  'book-open': BookOpen,
  flower: Flower2,
  stretch: PersonStanding,
  moon: Moon,
  apple: Apple,
  heart: Heart,
  sun: Sun,
  coffee: Coffee,
  'graduation-cap': GraduationCap,
  leaf: Leaf,
};
export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const Component = iconMap[name];
  return <Component size={size} color={color ?? colors.primary} strokeWidth={1.8} />;
}
