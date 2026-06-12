import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, FlatList, Dimensions, SectionList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Category, SubCategory } from '../../services/catalog.service';
import {
  useFonts,
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';

const RED = '#E10600';
const { height } = Dimensions.get('window');

interface FilterModalProps {
  visible:       boolean;
  categories:    Category[];
  subCategories: SubCategory[];
  selected:      number[];
  selectedSubs:  number[];
  onApply:       (selectedIds: number[], selectedSubIds: number[]) => void;
  onClose:       () => void;
}

export default function FilterModal({
  visible, categories, subCategories, selected, selectedSubs, onApply, onClose,
}: FilterModalProps) {

  const [checked,     setChecked]     = useState<number[]>(selected);
  const [checkedSubs, setCheckedSubs] = useState<number[]>(selectedSubs);
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold,
  });

  useEffect(() => {
    if (visible) {
      setChecked(selected);
      setCheckedSubs(selectedSubs);
    }
  }, [visible]);

  //Catégories
  const toggle = (id: number) => {
    setChecked(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setChecked(checked.length === categories.length ? [] : categories.map(c => c.id));
  };

  const allChecked = checked.length === categories.length && categories.length > 0;

  // Sous-catégories
  const toggleSub = (id: number) => {
    setCheckedSubs(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAllSubs = () => {
    setCheckedSubs(
      checkedSubs.length === subCategories.length ? [] : subCategories.map(s => s.id)
    );
  };

  const allSubsChecked = checkedSubs.length === subCategories.length && subCategories.length > 0;

  // Actions
  const handleApply = () => onApply(checked, checkedSubs);
  const handleReset = () => { setChecked([]); setCheckedSubs([]); };

  const totalSelected = checked.length + checkedSubs.length;

  //Row renderer 
  const renderRow = (label: string, isChecked: boolean, onPress: () => void) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
        {isChecked && <Feather name="check" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>

          {/* ── Handle ── */}
          <View style={styles.handle} />

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.title}>Filtres</Text>
            {totalSelected > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{totalSelected}</Text>
              </View>
            )}
          </View>

          <SectionList
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            sections={[
  ...(categories.length > 0 ? [{
    title:    'Catégories',
    data:     categories,
    type:     'category' as const,
    allLabel: 'Toutes les catégories',
    allFlag:  allChecked,
    onToggleAll: toggleAll,
  }] : []),
  ...(subCategories.length > 0 ? [{
    title:    'Sous-catégories',
    data:     subCategories,
    type:     'sub' as const,
    allLabel: 'Toutes les sous-catégories',
    allFlag:  allSubsChecked,
    onToggleAll: toggleAllSubs,
  }] : []),
]}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {renderRow(
                  section.allLabel,
                  section.allFlag,
                  section.onToggleAll,
                )}
                <View style={styles.divider} />
              </View>
            )}
            renderItem={({ item, section }) => {
              if (section.type === 'category') {
                const isChecked = checked.includes(item.id);
                return renderRow(item.name_fr, isChecked, () => toggle(item.id));
              } else {
                const isChecked = checkedSubs.includes(item.id);
                return renderRow(item.name_fr, isChecked, () => toggleSub(item.id));
              }
            }}
            renderSectionFooter={() => <View style={{ height: 12 }} />}
          />

          {/* ── Apply button ── */}
          <TouchableOpacity style={styles.btnApply} onPress={handleApply} activeOpacity={0.85}>
            <Text style={styles.btnApplyText}>
              {totalSelected > 0
                ? `Afficher (${totalSelected} filtre${totalSelected > 1 ? 's' : ''})`
                : 'Afficher tous les produits'}
            </Text>
          </TouchableOpacity>

          {/* ── Reset ── */}
          <TouchableOpacity style={styles.btnReset} onPress={handleReset} activeOpacity={0.7}>
            <Text style={styles.btnResetText}>Réinitialiser</Text>
          </TouchableOpacity>

        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
    maxHeight: height * 0.8,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 20,
  },

  // Header 
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  title:  { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#1a1a1a' },
  badge: {
    backgroundColor: RED, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff' },

  // Section
  scrollArea:    { maxHeight: height * 0.55 },
  sectionHeader: { marginTop: 4 },
  sectionTitle:  { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 15, color: '#1a1a1a', fontFamily: 'Inter_500Medium' },

  // Checkbox 
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: RED, borderColor: RED },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 4 },

  // Buttons
  btnApply: {
    backgroundColor: RED, borderRadius: 50,
    paddingVertical: 16, alignItems: 'center', marginTop: 16,
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  btnApplyText:  { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  btnReset:      { alignItems: 'center', paddingVertical: 12 },
  btnResetText:  { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
});