import React, { useCallback, useRef, useState } from 'react';
import {
  Animated, View, Text, StyleSheet, SafeAreaView, StatusBar,
  ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
} from '@expo-google-fonts/inter';
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FaqScreen() {
  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
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
        <>
          {/* ── Tabs catégories ── */}
          <View style={styles.tabsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsContent}
            >
              {categories.map(cat => {
                const active = activeTab === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.tab, active && styles.tabActive]}
                    onPress={() => setActiveTab(cat.id)}
                    activeOpacity={0.7}
                  >
                    {cat.icon && (
                      <Feather
                        name={cat.icon as any}
                        size={14}
                        color={active ? '#fff' : '#6B7280'}
                      />
                    )}
                    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                      {cat.name_fr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Accordéon ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            <Text style={styles.countLabel}>
              {activeCategory?.items.length ?? 0} question{(activeCategory?.items.length ?? 0) > 1 ? 's' : ''}
            </Text>

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
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabsWrap:    { backgroundColor: '#fff' },
  tabsContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 50, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E5E7EB',
  },
  tabActive:      { backgroundColor: RED },
  tabLabel:       { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  tabLabelActive: { color: '#fff' },

  // List
  list:       { paddingHorizontal: 16, paddingTop: 16 },
  countLabel: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: GRAY,
    marginBottom: 12, marginLeft: 2,
  },

  // Accordion
  accordionItem: {
    backgroundColor: '#fff', borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
    borderWidth: 1,
  borderColor: 'transparent',
  },
  accordionItemOpen: {
    borderColor: '#FEE2E2',
  },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16, gap: 12,
  },
  question:      { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A', lineHeight: 20 },
  questionOpen:  { color: RED },
  chevronBox: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  chevronBoxOpen:  { backgroundColor: '#FFF0F0' },
  accordionBody:   { paddingHorizontal: 16, paddingBottom: 16 },
  divider:         { height: 1, backgroundColor: '#F5F5F5', marginBottom: 12 },
  answer:          { fontSize: 13.5, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 21 },

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
  contactTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A', marginBottom: 2 },
  contactDesc:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY },

  // Empty
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: '#1A1A1A', marginBottom: 6 },
  emptyDesc:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY },
});