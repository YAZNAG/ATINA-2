import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, ActivityIndicator,
  Image, Alert,
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
import PageHeader from '../../components/ui/PageHeader';
import { SubstitutionService, type Substitution } from '../../services/substitution.service';

const RED   = '#E10600';
const GREEN = '#16A34A';

const STATUS_LABEL: Record<string, string> = {
  pending:  'En attente',
  accepted: 'Acceptée',
  refused:  'Refusée',
};

export default function OrderSubstitutionScreen() {
  const router = useRouter();
  const { order_id } = useLocalSearchParams<{ order_id: string }>();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold,
  });

  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [loading, setLoading]       = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!order_id) return;
    setLoading(true);
    try {
      const data = await SubstitutionService.getOrderSubstitutions(order_id);
      setSubstitutions(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Impossible de charger les substitutions');
    } finally {
      setLoading(false);
    }
  }, [order_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRespond = async (substitutionId: string, status: 'accepted' | 'refused') => {
    setResponding(substitutionId);
    try {
      const updated = await SubstitutionService.respondToSubstitution(substitutionId, status);
      setSubstitutions(prev =>
        prev.map(s => (s.id === substitutionId ? updated : s)),
      );
    } catch (err: any) {
      Alert.alert('Erreur', err?.message ?? 'Une erreur est survenue');
    } finally {
      setResponding(null);
    }
  };

  if (!fontsLoaded) return null;

  const pending   = substitutions.filter(s => s.status === 'pending');
  const processed = substitutions.filter(s => s.status !== 'pending');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.container}>
        <PageHeader title="Substitution produit" />

        <Text style={styles.subtitle}>
          Certains produits de votre commande sont indisponibles. Acceptez ou refusez les alternatives proposées.
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={RED} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Feather name="alert-circle" size={32} color="#9CA3AF" />
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : substitutions.length === 0 ? (
          <View style={styles.center}>
            <Feather name="check-circle" size={32} color="#9CA3AF" />
            <Text style={styles.emptyText}>Aucune substitution pour cette commande.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

            {pending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  En attente de votre réponse ({pending.length})
                </Text>
                {pending.map(sub => (
                  <SubstitutionCard
                    key={sub.id}
                    sub={sub}
                    onRespond={handleRespond}
                    responding={responding === sub.id}
                  />
                ))}
              </View>
            )}

            {processed.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Déjà traitées</Text>
                {processed.map(sub => (
                  <SubstitutionCard
                    key={sub.id}
                    sub={sub}
                    onRespond={handleRespond}
                    responding={false}
                  />
                ))}
              </View>
            )}

          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function SubstitutionCard({
  sub, onRespond, responding,
}: {
  sub: Substitution;
  onRespond: (id: string, status: 'accepted' | 'refused') => void;
  responding: boolean;
}) {
  const badgeStyle = sub.status === 'accepted'
    ? styles.badgeAccepted
    : sub.status === 'refused'
    ? styles.badgeRefused
    : styles.badgePending;

  return (
    <View style={styles.card}>

      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderText}>Produit indisponible</Text>
        <View style={[styles.badge, badgeStyle]}>
          <Text style={styles.badgeText}>{STATUS_LABEL[sub.status]}</Text>
        </View>
      </View>

      {/* Produit original */}
      <View style={styles.productRow}>
        {sub.original_sku?.image_url ? (
          <Image source={{ uri: sub.original_sku.image_url }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.productImagePlaceholder]}>
            <Feather name="package" size={18} color="#9CA3AF" />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productLabel}>Indisponible</Text>
          <Text style={styles.productName} numberOfLines={1}>
            {sub.original_sku?.name_fr}
          </Text>
        </View>
      </View>

      <View style={styles.arrowRow}>
        <Feather name="arrow-down" size={16} color="#9CA3AF" />
        <Text style={styles.arrowText}>remplacé par</Text>
      </View>

      {/* Produit proposé */}
      {sub.substitute_sku ? (
        <View style={[styles.productRow, styles.proposedRow]}>
          {sub.substitute_sku.image_url ? (
            <Image source={{ uri: sub.substitute_sku.image_url }} style={styles.productImage} />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder]}>
              <Feather name="package" size={18} color="#9CA3AF" />
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={[styles.productLabel, { color: GREEN }]}>Alternative proposée</Text>
            <Text style={styles.productName} numberOfLines={1}>
              {sub.substitute_sku.name_fr}
            </Text>
            {sub.substitute_sku.price != null && (
              <Text style={styles.productPrice}>
                {Number(sub.substitute_sku.price).toFixed(2)} MAD
              </Text>
            )}
          </View>
        </View>
      ) : (
        <Text style={styles.noAlternative}>Aucune alternative trouvée pour ce produit.</Text>
      )}

      {sub.reason && (
        <Text style={styles.reasonText}>Note du préparateur : {sub.reason}</Text>
      )}

      {/* Actions */}
      {sub.status === 'pending' && sub.substitute_sku && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btnRefuse, responding && styles.btnDisabled]}
            onPress={() => onRespond(sub.id, 'refused')}
            disabled={responding}
            activeOpacity={0.85}
          >
            {responding ? (
              <ActivityIndicator size="small" color={RED} />
            ) : (
              <Text style={styles.btnRefuseText}>Refuser</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnAccept, responding && styles.btnDisabled]}
            onPress={() => onRespond(sub.id, 'accepted')}
            disabled={responding}
            activeOpacity={0.85}
          >
            {responding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnAcceptText}>Accepter</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 12 },

  subtitle: {
    fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280',
    lineHeight: 20, marginBottom: 20,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF', textAlign: 'center' },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12,
  },

  card: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 16, marginBottom: 14, backgroundColor: '#fff', gap: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#374151' },

  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgePending:  { backgroundColor: '#FEF3C7' },
  badgeAccepted: { backgroundColor: '#DCFCE7' },
  badgeRefused:  { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#374151' },

  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  proposedRow: { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' },
  productImage: { width: 44, height: 44, borderRadius: 10 },
  productImagePlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1 },
  productLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: RED, marginBottom: 2 },
  productName:  { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  productPrice: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: GREEN, marginTop: 2 },

  arrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  arrowText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },

  noAlternative: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', fontStyle: 'italic' },
  reasonText: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF',
    fontStyle: 'italic', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8,
  },

  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  btnRefuse: {
    flex: 1, borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 12,
    paddingVertical: 11, alignItems: 'center',
  },
  btnRefuseText: { color: RED, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  btnAccept: {
    flex: 1, backgroundColor: GREEN, borderRadius: 12,
    paddingVertical: 11, alignItems: 'center',
  },
  btnAcceptText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  btnDisabled: { opacity: 0.6 },
});