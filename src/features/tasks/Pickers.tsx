import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Text } from '@/components';
import { useTheme } from '@/theme';
import type { IconName } from '@/types';
import { taskColors } from './templates';

const categories: Record<string, IconName[]> = {
  health: ['droplets', 'apple', 'heart'],
  fitness: ['activity', 'stretch'],
  study: ['book-open', 'graduation-cap'],
  lifestyle: ['sun', 'coffee', 'moon'],
  mindfulness: ['flower', 'leaf'],
  custom: [
    'droplets',
    'activity',
    'book-open',
    'flower',
    'stretch',
    'moon',
    'apple',
    'heart',
    'sun',
    'coffee',
    'graduation-cap',
    'leaf',
  ],
};

export function IconPicker({
  value,
  onChange,
  color,
}: {
  value: IconName;
  onChange: (icon: IconName) => void;
  color: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [category, setCategory] = useState('custom');
  return (
    <View style={styles.group}>
      <Text variant="headline">{t('form.icon')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {Object.keys(categories).map((key) => (
          <Pressable
            key={key}
            onPress={() => setCategory(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: key === category }}
            style={[
              styles.category,
              { backgroundColor: key === category ? colors.primarySoft : colors.surfaceAlt },
            ]}
          >
            <Text
              variant="caption"
              color={key === category ? colors.primary : colors.textSecondary}
            >
              {t(`form.categories.${key}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.icons}>
        {categories[category]?.map((icon) => (
          <Pressable
            key={icon}
            accessibilityRole="button"
            accessibilityLabel={t(`form.icons.${icon}`)}
            accessibilityState={{ selected: value === icon }}
            onPress={() => onChange(icon)}
            style={[
              styles.icon,
              {
                backgroundColor: value === icon ? `${color}20` : colors.surfaceAlt,
                borderColor: value === icon ? color : 'transparent',
              },
            ]}
          >
            <Icon name={icon} size={24} color={value === icon ? color : colors.textSecondary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text variant="headline">{t('form.color')}</Text>
      <View style={styles.colors}>
        {taskColors.map((color, index) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={t(`form.colors.${index}`)}
            accessibilityState={{ selected: value === color }}
            onPress={() => onChange(color)}
            style={[
              styles.colorTarget,
              { borderColor: value === color ? colors.textPrimary : 'transparent' },
            ]}
          >
            <View style={[styles.color, { backgroundColor: color }]}>
              {value === color && <Check color={colors.surface} size={21} />}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ChoiceGroup<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.choices}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option.value, disabled }}
          onPress={() => onChange(option.value)}
          disabled={disabled}
          style={[
            styles.choice,
            {
              backgroundColor: value === option.value ? colors.primarySoft : colors.surfaceAlt,
              opacity: disabled ? 0.65 : 1,
            },
          ]}
        >
          <Text
            variant="caption"
            color={value === option.value ? colors.primary : colors.textSecondary}
            style={styles.choiceText}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 14 },
  categories: { gap: 8 },
  category: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center' },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  icon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  colorTarget: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  color: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceText: { textAlign: 'center', fontWeight: '500' },
});
