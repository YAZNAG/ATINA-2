import { useState, useEffect } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  Text, Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  getHistory, addToHistory, removeFromHistory, clearHistory,
} from '../../utils/searchHistory';

const RED = '#E10600';

interface SearchBarProps {
  value:          string;
  onChangeText:   (text: string) => void;
  onSubmit?:      (text: string) => void;
  onFilter?:      () => void;
  onPress?:       () => void;   // NEW: si fourni, tap = navigation au lieu d'édition
  placeholder?:   string;
  articleNames?:  string[];
}

export default function SearchBar({
  value, onChangeText, onSubmit, onFilter, onPress,
  placeholder = 'Rechercher des produits...',
  articleNames = [],
}: SearchBarProps) {
  const [focused,  setFocused]  = useState(false);
  const [history,  setHistory]  = useState<string[]>([]);

  useEffect(() => {
    if (focused) getHistory().then(setHistory);
  }, [focused]);

  const suggestions = value.length > 1
    ? [...new Set(articleNames)]
        .filter(n => n.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 6)
    : [];

  const showHistory     = focused && value.length === 0 && history.length > 0;
  const showSuggestions = focused && suggestions.length > 0;
  const showDropdown    = !onPress && (showHistory || showSuggestions);

  const handleSelect = async (term: string) => {
    await addToHistory(term);
    onChangeText(term);
    onSubmit?.(term);
    setFocused(false);
    Keyboard.dismiss();
  };

  const handleSubmit = async () => {
    const t = value.trim();
    if (t) { await addToHistory(t); onSubmit?.(t); }
    setFocused(false);
    Keyboard.dismiss();
  };

  const handleRemove = async (term: string) => {
    await removeFromHistory(term);
    setHistory(prev => prev.filter(h => h !== term));
  };

  const handleClear = async () => {
    await clearHistory();
    setHistory([]);
  };

  const BoxWrapper = onPress ? TouchableOpacity : View;

  return (
    <View style={styles.wrapper}>
      {/* ── Input row ── */}
      <View style={styles.container}>
        <BoxWrapper
          style={[styles.searchBox, focused && styles.searchBoxFocused]}
          {...(onPress ? { onPress, activeOpacity: 0.8 } : {})}
        >
          <Feather name="search" size={20} color={focused ? RED : '#9CA3AF'} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            editable={!onPress}
            pointerEvents={onPress ? 'none' : 'auto'}
          />
          {!onPress && value.length > 0 && (
            <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearBtn}>
              <Feather name="x" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.filterBtn} onPress={onFilter} activeOpacity={0.85}>
            <Feather name="sliders" size={18} color="#fff" />
          </TouchableOpacity>
        </BoxWrapper>
      </View>

      {/* ── Dropdown ── */}
      {showDropdown && (
        <View style={styles.dropdown}>
          {showHistory && (
            <>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Recherches récentes</Text>
                <TouchableOpacity onPress={handleClear}>
                  <Text style={styles.clearAll}>Effacer tout</Text>
                </TouchableOpacity>
              </View>
              {history.map(term => (
                <View key={term} style={styles.dropdownRow}>
                  <TouchableOpacity style={styles.dropdownRowLeft} onPress={() => handleSelect(term)}>
                    <Feather name="clock" size={15} color="#9CA3AF" />
                    <Text style={styles.dropdownText} numberOfLines={1}>{term}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemove(term)} style={styles.removeBtn}>
                    <Feather name="x" size={14} color="#C0C0C0" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {showSuggestions && (
            <>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Suggestions</Text>
              </View>
              {suggestions.map(term => (
                <TouchableOpacity key={term} style={styles.dropdownRow} onPress={() => handleSelect(term)}>
                  <Feather name="search" size={15} color="#9CA3AF" />
                  <Text style={[styles.dropdownText, { marginLeft: 10 }]} numberOfLines={1}>{term}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { paddingHorizontal: 16, marginBottom: 4, zIndex: 999 },
  container:  { marginBottom: 4 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 16,
    paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  searchBoxFocused: { borderColor: RED, backgroundColor: '#fff' },

  icon:     { marginRight: 10 },
  input:    { flex: 1, fontSize: 15, color: '#1a1a1a', fontFamily: 'Inter_400Regular', padding: 0, paddingVertical: 8 },
  clearBtn: { marginRight: 8 },
  filterBtn: {
    width: 40, height: 40, borderRadius: 15,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
  },

  dropdown: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 8,
    overflow: 'hidden', marginTop: 2,
  },
  dropdownHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  dropdownTitle: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  clearAll:      { fontSize: 13, color: RED, fontFamily: 'Inter_500Medium' },

  dropdownRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F9F9F9',
  },
  dropdownRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownText:    { flex: 1, fontSize: 14, color: '#1a1a1a', fontFamily: 'Inter_400Regular' },
  removeBtn:       { padding: 4 },
});