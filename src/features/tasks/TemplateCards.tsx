import { Pressable, StyleSheet, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Text } from '@/components';
import { useTheme } from '@/theme';
import { templates } from './templates';

export function TemplateCards({
  onSelect,
  busy,
}: {
  onSelect: (key: string) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text variant="headline" style={styles.heading}>
        {t('home.templates')}
      </Text>
      <View style={styles.grid}>
        {templates.map((template) => (
          <Pressable
            key={template.key}
            accessibilityRole="button"
            accessibilityLabel={t(`templates.${template.key}`)}
            disabled={busy}
            onPress={() => onSelect(template.key)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.surface, opacity: pressed || busy ? 0.6 : 1 },
            ]}
          >
            <View style={styles.top}>
              <View style={[styles.icon, { backgroundColor: `${template.color}18` }]}>
                <Icon name={template.icon} size={23} color={template.color} />
              </View>
              <Plus size={16} color={colors.textSecondary} />
            </View>
            <Text variant="headline">{t(`templates.${template.key}`)}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {t(`templates.${template.key}Hint`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 32 },
  heading: { marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, flexBasis: '44%', borderRadius: 24, padding: 18, gap: 7, minHeight: 152 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  icon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
