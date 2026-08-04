import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { walletService, WalletTransaction } from '../../services/wallet.service';
import PageHeader from '@/components/ui/PageHeader';

const COLORS = {
  primary: '#E10600',
  accent: '#E62A27',
  bg: '#ffffff',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#8A8A8E',
  border: '#EDEDED',
  in: '#1E9E5A',
  out: '#E10600',
};

export default function WalletScreen() {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      const wallet = await walletService.getWallet();
      setBalance(wallet.customer.wallet_balance);

      const txns = await walletService.getTransactions(1, 20);
      setTransactions(txns.data);
      setPage(1);
      setTotalPages(txns.pagination.pages);
    } catch (err) {
      console.error('Erreur chargement wallet:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
  useCallback(() => {
    loadInitial();
  }, [loadInitial])
);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    try {
      setLoadingMore(true);
      const next = page + 1;
      const txns = await walletService.getTransactions(next, 20);
      setTransactions((prev) => [...prev, ...txns.data]);
      setPage(next);
    } catch (err) {
      console.error('Erreur chargement transactions:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const renderItem = ({ item }: { item: WalletTransaction }) => {
    const isCredit = item.txn_type.direction === 'IN';
    return (
      <View style={styles.txnRow}>
        <View
          style={[
            styles.txnIcon,
            { backgroundColor: isCredit ? '#E6F7ED' : '#FDEAEA' },
          ]}
        >
          <Feather
            name={isCredit ? 'arrow-down' : 'arrow-up'}
            size={18}
            color={isCredit ? COLORS.in : COLORS.out}
          />
        </View>
        <View style={styles.txnInfo}>
          <Text style={styles.txnLabel}>{item.txn_type.name_fr}</Text>
          {item.note ? <Text style={styles.txnNote}>{item.note}</Text> : null}
          <Text style={styles.txnDate}>
            {new Date(item.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Text
          style={[
            styles.txnAmount,
            { color: isCredit ? COLORS.in : COLORS.out },
          ]}
        >
          {isCredit ? '+' : '-'}
          {Number(item.amount).toFixed(2)} MAD
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Wallet" />
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Solde disponible</Text>
        <Text style={styles.balanceValue}>
          {Number(balance ?? 0).toFixed(2)} <Text style={styles.balanceCurrency}>MAD</Text>
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Historique</Text>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="credit-card" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucune transaction pour le moment</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  balanceCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  balanceLabel: {
    color: '#FFF',
    opacity: 0.85,
    fontSize: 13,
    fontFamily: 'Inter',
    marginBottom: 6,
  },
  balanceValue: {
    color: '#FFF',
    fontSize: 32,
    fontFamily: 'Poppins-SemiBold',
  },
  balanceCurrency: {
    fontSize: 16,
    fontFamily: 'Inter',
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Poppins-Medium',
    color: COLORS.text,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txnInfo: { flex: 1 },
  txnLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: COLORS.text,
  },
  txnNote: {
    fontSize: 12,
    fontFamily: 'Inter',
    color: COLORS.textMuted,
    marginTop: 1,
  },
  txnDate: {
    fontSize: 11,
    fontFamily: 'Inter',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontFamily: 'Inter',
  },
});