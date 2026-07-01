import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Article } from '../../services/catalog.service';

const RED = '#E10600';

export type SortOption = 'default' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';

export interface TabOption {
  value:  string;
  label:  string;
  badge?: number;
}

const SORT_OPTIONS: TabOption[] = [
  { value: 'default',    label: 'Pertinence' },
  { value: 'price_asc',  label: 'Prix ↑' },
  { value: 'price_desc', label: 'Prix ↓' },
  { value: 'name_asc',   label: 'A → Z' },
  { value: 'name_desc',  label: 'Z → A' },
];


interface Props {
  value:         string;
  onChange:      (v: string) => void;
  options?:      TabOption[];
  paddingLeft?:  number;
  wrapperStyle?: object;
}

export default function SortBar({ value, onChange, options, paddingLeft, wrapperStyle }: Props) {
  const tabs = options ?? SORT_OPTIONS;

  return (
    <View style={[styles.wrapper, wrapperStyle]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.container, paddingLeft != null && { paddingLeft }]}
      >
        {tabs.map(opt => {
          const active = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
              {opt.badge != null && opt.badge > 0 && (
                <View style={[styles.badge, active && styles.badgeActive]}>
                  <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                    {opt.badge > 99 ? '99+' : opt.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function sortArticles(articles: Article[], sort: SortOption): Article[] {
  switch (sort) {
    case 'price_asc':  return [...articles].sort((a, b) => a.price_ttc - b.price_ttc);
    case 'price_desc': return [...articles].sort((a, b) => b.price_ttc - a.price_ttc);
    case 'name_asc':   return [...articles].sort((a, b) => a.name_fr.localeCompare(b.name_fr));
    case 'name_desc':  return [...articles].sort((a, b) => b.name_fr.localeCompare(a.name_fr));
    default:           return articles;
  }
}


const styles = StyleSheet.create({
  wrapper: {},
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  pillActive:  { backgroundColor: RED, borderColor: RED },
  label:       { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_500Medium' },
  labelActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeActive:     { backgroundColor: 'rgba(255,255,255,0.3)' },
  badgeText:       { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  badgeTextActive: { color: '#fff' },
});
