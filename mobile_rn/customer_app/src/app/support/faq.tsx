import React, { useCallback, useRef, useState } from 'react';
import {
  Animated, View, Text, StyleSheet, SafeAreaView, StatusBar,
  ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import PageHeader from '../../components/ui/PageHeader';
import { FaqService, FaqCategory, FaqItem } from '../../services/faq.service';

const RED  = '#E10600';
const GRAY = '#9CA3AF';

function AccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.timing(animation, {
      toValue:         open ? 0 : 1,
      duration:        250,
      useNativeDriver: false,
    }).start();
    setOpen(o => !o);
  };

  const maxHeight = animation.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 300],
  });

  return (
    <View style={[styles.accordionItem, open && styles.accordionItemOpen]}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.question, open && styles.questionOpen]} numberOfLines={open ? undefined : 2}>
          {item.question_fr}
        </Text>
        <View style={[styles.chevronBox, open && styles.chevronBoxOpen]}>
          <Feather
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={open ? RED : GRAY}
          />
        </View>
      </TouchableOpacity>

      <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
        <View style={styles.accordionBody}>
          <View style={styles.divider} />
          <Text style={styles.answer}>{item.answer_fr}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function FaqScreen() {
  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Poppins_400Regular, Poppins_500Medium,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await FaqService.getAll();
      setCategories(data);
      if (data.length > 0) setActiveTab(data[0].id);
    } catch (e) {
      console.error('FAQ load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const router = useRouter();

  if (!fontsLoaded) return null;

  const activeCategory = categories.find(c => c.id === activeTab);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <PageHeader title="Centre d'aide" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Feather name="help-circle" size={32} color={GRAY} />
          </View>
          <Text style={styles.emptyTitle}>Aucune question disponible</Text>
          <Text style={styles.emptyDesc}>Revenez plus tard.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {/* ── Grille catégories ── */}
          <View style={styles.grid}>
            {categories.map(cat => {
              const active = activeTab === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.gridCard, active && styles.gridCardActive]}
                  onPress={() => setActiveTab(cat.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.gridIconBox, active && styles.gridIconBoxActive]}>
                    {cat.icon && (
                      <Feather
                        name={cat.icon as any}
                        size={20}
                        color={active ? RED : '#6B7280'}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.gridLabel, active && styles.gridLabelActive]}
                    numberOfLines={2}
                  >
                    {cat.name_fr}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Accordéon ── */}
          <Text style={styles.sectionTitle}>Questions fréquentes</Text>

          {activeCategory?.items.map(item => (
            <AccordionItem key={item.id} item={item} />
          ))}

          {/* Card contact */}
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => router.push('/support/conversations' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.contactIcon}>
              <Feather name="message-circle" size={22} color={RED} />
            </View>
            <View style={styles.contactText}>
              <Text style={styles.contactTitle}>Pas trouvé votre réponse ?</Text>
              <Text style={styles.contactDesc}>Notre équipe est disponible pour vous aider.</Text>
            </View>
            <Feather name="chevron-right" size={18} color={GRAY} />
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const CARD_GAP = 10;

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // List / page padding
  list: { paddingHorizontal: 16, paddingTop: 16 },

  // Grid catégories (3 par ligne)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
  width: `${(100 - 2 * 6) / 3}%`,
  backgroundColor: '#ffffff',
  borderRadius: 16,
  paddingVertical: 16,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: CARD_GAP,
  borderWidth: 1.5,
  borderColor: '#F9FAFB',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 2,
},
  gridCardActive: {
    backgroundColor: '#ffffff',
    borderColor: RED,
  },
  gridIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  gridIconBoxActive: {
    backgroundColor: '#E1060021',
  },
  gridLabel: {
    fontSize: 12.5,
    fontFamily: 'Poppins_600SemiBold',
    color: '#111827',
    textAlign: 'center',
  },
  gridLabelActive: {
    color: RED,
  },

  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#1A1A1A',
    marginTop: 8,
    marginBottom: 14,
  },

  // Accordion
  accordionItem: {
    backgroundColor: '#fff', borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  accordionItemOpen: {
    borderColor: '#FEE2E2',
  },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16, gap: 12,
  },
  question:      { flex: 1, fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#1A1A1A', lineHeight: 20 },
  questionOpen:  { color: RED },
  chevronBox: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  chevronBoxOpen:  { backgroundColor: '#FFF0F0' },
  accordionBody:   { paddingHorizontal: 16, paddingBottom: 16 },
  divider:         { height: 1, backgroundColor: '#F5F5F5', marginBottom: 12 },
  answer:          { fontSize: 13.5, fontFamily: 'Poppins_400Regular', color: '#1A1A1A', lineHeight: 21 },

  // Contact
  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginTop: 8,
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  contactIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#FFF0F0',
    alignItems: 'center', justifyContent: 'center',
  },
  contactText:  { flex: 1 },
  contactTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: '#1A1A1A', marginBottom: 2 },
  contactDesc:  { fontSize: 12, fontFamily: 'Poppins_400Regular', color: GRAY },

  // Empty
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: '#1A1A1A', marginBottom: 6 },
  emptyDesc:  { fontSize: 13, fontFamily: 'Poppins_400Regular', color: GRAY },
});