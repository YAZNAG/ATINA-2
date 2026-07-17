import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Platform, ScrollView,
  ActivityIndicator, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium,
 Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import { findPickupNodes } from '../../services/order.service';
import type { Node } from '../../services/order.service';
import PageHeader from '../../components/ui/PageHeader';
import CheckoutStepper from '@/components/ui/CheckoutStepper';

const RED = '#E10600';

export default function CheckoutPickupScreen() {
  const router = useRouter();
  const { cart_items } = useLocalSearchParams<{ cart_items: string }>();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium,
 Inter_600SemiBold, Inter_700Bold,
  });

  const [nodes, setNodes]       = useState<Node[]>([]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

useEffect(() => {
  (async () => {
    try {
      const items = cart_items ? JSON.parse(cart_items) : [];
      const result = await findPickupNodes(items);

      const list = Array.isArray(result) ? result : [];
      setNodes(list);
      if (list.length > 0) setSelected(list[0]);
    } catch (e: any) {
      console.log('[DEBUG] pickup error:', e?.statusCode, e?.message);
      setError(e.message || 'Erreur chargement magasins');
      setNodes([]);
    } finally {
      setLoading(false);
    }
  })();
}, []);

  if (!fontsLoaded) return null;

  const handleOpenMaps = (node: Node) => {
    if (!node?.lat || !node?.lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${node.lat},${node.lng}`;
    Linking.openURL(url);
  };

  const handleConfirm = () => {
    if (!selected) return;
    router.replace({
      pathname: '/order/delivery_datetime' as any,
      params: {
        delivery_type_code: 'pickup',
        node_id:            selected.id,
        node_name:          selected.name,
        cart_items,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.container}>

        {/* ── Header ── */}
        <PageHeader title="Retrait en magasin" />

        {/* ── Stepper ── */}
        <CheckoutStepper currentStep={1} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* ── Bannière magasin sélectionné ── */}
          {selected && (
            <View style={styles.selectedBanner}>
              <View style={styles.selectedIconWrap}>
                <Feather name="shopping-bag" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedLabel}>Magasin sélectionné</Text>
                <Text style={styles.selectedName}>{selected.name}</Text>
                <Text style={styles.selectedAddress} numberOfLines={1}>{selected.address}</Text>
              </View>
              {selected.distance != null && (
                <View style={styles.selectedDistance}>
                  <Feather name="navigation" size={12} color={RED} />
                  <Text style={styles.selectedDistanceText}>
                    {selected.distance >= 1
                      ? `${selected.distance.toFixed(1)} km`
                      : `${Math.round(selected.distance * 1000)} m`}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Ouvrir dans Maps ── */}
          {selected && (
            <TouchableOpacity style={styles.openMapsBtn} onPress={() => handleOpenMaps(selected)} activeOpacity={0.8}>
              <Feather name="navigation" size={15} color={RED} />
              <Text style={styles.openMapsText}>Ouvrir dans Maps</Text>
              <Feather name="arrow-up-right" size={15} color={RED} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}

          {/* ── Loading / Error ── */}
          {loading && (
            <View style={styles.centered}>
              <ActivityIndicator color={RED} />
            </View>
          )}
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && nodes.length === 0 && (
            <View style={styles.centered}>
              <Feather name="map-pin" size={40} color="#E0E0E0" />
              <Text style={styles.emptyText}>Aucun magasin disponible</Text>
            </View>
          )}

          {/* ── Titre liste ── */}
          {nodes.length > 0 && (
            <Text style={styles.listTitle}>Magasins à proximité</Text>
          )}

          {/* ── Store cards ── */}
          {nodes.map((node) => (
            <TouchableOpacity
              key={node.id}
              style={[styles.storeCard, selected?.id === node.id && styles.storeCardSelected]}
              onPress={() => setSelected(node)}
              activeOpacity={0.85}
            >
              <View style={styles.storeCardHeader}>
                <View style={styles.storeIconWrap}>
                  <Feather name="shopping-bag" size={16} color={RED} />
                </View>
                <Text style={styles.storeName}>{node.name}</Text>
                {selected?.id === node.id && (
                  <View style={styles.checkWrap}>
                    <Feather name="check" size={14} color="#fff" />
                  </View>
                )}
              </View>

              <Text style={styles.storeSubtitle}>{node.address}</Text>

              <View style={styles.storeDetails}>
                <View style={styles.storeDetailRow}>
                  <Feather name="map-pin" size={13} color={RED} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.storeDetailLabel}>Adresse</Text>
                    <Text style={styles.storeDetailValue}>{node.address}</Text>
                  </View>
                </View>

                <View style={styles.storeDetailRow}>
                  <Feather name="clock" size={13} color={RED} />
                  <View>
                    <Text style={styles.storeDetailLabel}>Ouvert</Text>
                    <Text style={styles.storeDetailValue}>09:00 – 22:00</Text>
                  </View>
                </View>

                {node.distance != null && (
                  <View style={styles.storeDetailRow}>
                    <Feather name="navigation" size={13} color={RED} />
                    <View>
                      <Text style={styles.storeDetailLabel}>Distance</Text>
                      <Text style={styles.storeDetailValue}>
                        {node.distance >= 1
                          ? `${node.distance.toFixed(1)} km`
                          : `${Math.round(node.distance * 1000)} m`}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* mini bouton maps par carte */}
              {node.lat && node.lng && (
                <TouchableOpacity
                  style={styles.cardMapsBtn}
                  onPress={() => handleOpenMaps(node)}
                  activeOpacity={0.7}
                >
                  <Feather name="navigation" size={13} color={RED} />
                  <Text style={styles.cardMapsText}>Itinéraire</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}

        </ScrollView>

        {/* ── Confirm button ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btnConfirm, !selected && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Confirmer le magasin</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 16, paddingTop: 12 },

  // Bannière magasin sélectionné
  selectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: RED,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  selectedIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  selectedLabel:    { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  selectedName:     { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#1a1a1a' },
  selectedAddress:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  selectedDistance: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF0F0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  selectedDistanceText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: RED },

  // Open maps
  openMapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: RED, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, backgroundColor: '#fff' },
  openMapsText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: RED },

  // Liste
  listTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#1a1a1a', marginBottom: 12, marginTop: 4 },

  // Store card
  storeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  storeCardSelected: { borderColor: RED, backgroundColor: '#FFF8F8' },
  storeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  storeIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFE8E8', alignItems: 'center', justifyContent: 'center' },
  storeName: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  checkWrap: { width: 22, height: 22, borderRadius: 11, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  storeSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginBottom: 14 },
  storeDetails: { gap: 10 },
  storeDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  storeDetailLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF', lineHeight: 16 },
  storeDetailValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  cardMapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#FFF0F0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  cardMapsText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: RED },

  // Misc
  centered:  { alignItems: 'center', paddingVertical: 24 },
  errorText: { color: RED, fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginVertical: 12 },
  emptyText: { color: '#9CA3AF', fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 12 },

  // Footer
  footer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 32 : 20, left: 16, right: 16 },
  btnConfirm: { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  btnDisabled: { backgroundColor: '#E5E7EB',  shadowColor: '#00000026', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});