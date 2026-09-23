import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { t, isRTL } from '../i18n';

/**
 * Charte de la maquette Figma « app client » : rouge Atina, fonds blancs, coins arrondis,
 * ombres douces, police Inter. Tous les écrans du catalogue et du profil s'appuient dessus.
 */
export const C = {
  red: '#E10600',
  redDark: '#B80500',
  redSoft: '#FDECEC',
  redTint: '#FFF4F4',
  yellow: '#FFD400',
  ink: '#0A0A0A',
  body: '#4B4B4B',
  grey: '#8A8A8A',
  greyLight: '#B5B5B5',
  line: '#EFEFEF',
  bg: '#FFFFFF',
  bgSoft: '#F7F7F7',
  green: '#15803D',
  greenSoft: '#EAF7EE',
};

export const R = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  black: 'Inter_800ExtraBold',
};

/** Ombre douce des cartes de la maquette. */
export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;

/** En-tête d'écran : bouton retour rond, titre centré, action optionnelle à droite. */
export function ScreenHeader({
  title, onBack, right, subtitle,
}: { title: string; onBack?: () => void; right?: React.ReactNode; subtitle?: string }) {
  return (
    <View style={k.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={k.back} accessibilityLabel={t('Retour')} hitSlop={8}>
          <Feather name={isRTL() ? 'chevron-right' : 'chevron-left'} size={20} color={C.ink} />
        </TouchableOpacity>
      ) : <View style={{ width: 36 }} />}
      <View style={{ flex: 1 }}>
        <Text style={k.headerTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={k.headerSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <View style={k.headerRight}>{right ?? <View style={{ width: 36 }} />}</View>
    </View>
  );
}

/** Titre de section avec lien « Voir tout ». */
export function SectionTitle({ title, onSeeAll, seeAllLabel }: { title: string; onSeeAll?: () => void; seeAllLabel?: string }) {
  return (
    <View style={k.sectionRow}>
      <Text style={k.sectionTitle}>{title}</Text>
      {!!onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={8} style={k.seeAllBtn}>
          <Text style={k.seeAll}>{seeAllLabel ?? t('Voir tout')}</Text>
          <Feather name={isRTL() ? 'chevron-left' : 'chevron-right'} size={14} color={C.red} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Bouton principal rouge pleine largeur (avec icône facultative). */
export function PrimaryButton({
  label, onPress, loading, disabled, icon, style,
}: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap; style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      style={[k.primary, (disabled || loading) && k.primaryOff, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      {loading ? <ActivityIndicator color="#fff" /> : (
        <>
          {!!icon && <Feather name={icon} size={18} color="#fff" />}
          <Text style={k.primaryText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/** Pastille de filtre / chip texte (sélectionnée = rouge). */
export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[k.chip, active && k.chipActive]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityState={{ selected: !!active }}
    >
      <Text style={[k.chipText, active && k.chipTextActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Sélecteur de quantité rond (maquette : − valeur +). */
export function QtyStepper({
  value, onChange, min = 1, max, busy,
}: { value: number; onChange: (v: number) => void; min?: number; max?: number; busy?: boolean }) {
  const dec = () => value > min && onChange(value - 1);
  const inc = () => (max == null || value < max) && onChange(value + 1);
  return (
    <View style={k.stepper}>
      <TouchableOpacity style={k.stepBtn} onPress={dec} disabled={busy || value <= min} accessibilityLabel={t('Retirer')}>
        <Feather name={value <= min ? 'trash-2' : 'minus'} size={15} color="#fff" />
      </TouchableOpacity>
      <Text style={k.stepValue}>{busy ? '…' : value}</Text>
      <TouchableOpacity style={k.stepBtn} onPress={inc} disabled={busy || (max != null && value >= max)} accessibilityLabel={t('Ajouter')}>
        <Feather name="plus" size={15} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

/** État vide illustré (icône ronde, titre, texte, action). */
export function EmptyState({
  icon = 'inbox', title, text, actionLabel, onAction,
}: {
  icon?: keyof typeof Feather.glyphMap; title: string; text?: string;
  actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={k.empty}>
      <View style={k.emptyIcon}><Feather name={icon} size={30} color={C.red} /></View>
      <Text style={k.emptyTitle}>{title}</Text>
      {!!text && <Text style={k.emptyText}>{text}</Text>}
      {!!actionLabel && !!onAction && (
        <TouchableOpacity style={k.emptyBtn} onPress={onAction} activeOpacity={0.85}>
          <Text style={k.emptyBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Badge de remise jaune (−X %) de la maquette. */
export function DiscountBadge({ value }: { value: number }) {
  return <View style={k.badge}><Text style={k.badgeText}>-{value}%</Text></View>;
}

export const k = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.lg, paddingTop: 6, paddingBottom: S.md, backgroundColor: C.bg,
  },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center', ...shadow,
  },
  headerTitle: { textAlign: 'center', fontSize: 17, color: C.ink, fontFamily: F.bold },
  headerSub: { textAlign: 'center', fontSize: 12, color: C.grey, fontFamily: F.regular, marginTop: 1 },
  headerRight: { minWidth: 36, alignItems: 'flex-end' },

  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.lg, marginTop: S.xl, marginBottom: S.md,
  },
  sectionTitle: { fontSize: 16, color: C.ink, fontFamily: F.bold },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { fontSize: 13, color: C.red, fontFamily: F.semi },

  primary: {
    backgroundColor: C.red, borderRadius: R.md, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    shadowColor: C.red, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  primaryOff: { opacity: 0.45 },
  primaryText: { color: '#fff', fontSize: 15.5, fontFamily: F.semi },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill,
    backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.line,
  },
  chipActive: { backgroundColor: C.redSoft, borderColor: C.red },
  chipText: { fontSize: 13, color: C.body, fontFamily: F.medium },
  chipTextActive: { color: C.red, fontFamily: F.bold },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: C.red,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValue: { minWidth: 22, textAlign: 'center', fontSize: 15, color: C.ink, fontFamily: F.bold },

  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: S.md },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.redSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16.5, color: C.ink, fontFamily: F.bold, textAlign: 'center' },
  emptyText: { fontSize: 13.5, lineHeight: 20, color: C.grey, fontFamily: F.regular, textAlign: 'center' },
  emptyBtn: {
    marginTop: S.sm, backgroundColor: C.red, borderRadius: R.pill,
    paddingHorizontal: 22, paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontFamily: F.semi },

  badge: { backgroundColor: C.yellow, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: C.ink, fontSize: 10.5, fontFamily: F.bold },
});
