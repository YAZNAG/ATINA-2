import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import supportService, {
  SupportConversation,
  SupportMessage,
  ConversationStatus,
  SupportCategory,
} from '../../services/support.service';
import { useSupportSocket } from '../../hooks/useSupportSocket';

const RED = '#E10600';

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  ORDER: 'Commande',
  ACCOUNT: 'Compte',
  LOYALTY: 'Fidélité',
  PRODUCT: 'Produit',
  OTHER: 'Autre',
};

const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string }> = {
  OPEN: { label: 'Ouverte', color: '#22C55E' },
  PENDING: { label: 'En attente', color: '#F59E0B' },
  RESOLVED: { label: 'Résolue', color: '#F59E0B' },
  CLOSED: { label: 'Fermée', color: '#94A3B8' },
};

type PendingMessage = SupportMessage & { _pending?: boolean };

function formatTime(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateString: string): string {
  const d = new Date(dateString);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Aujourd'hui";
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export default function ChatScreen() {
  const { id, initialText } = useLocalSearchParams<{
    id?: string;
    initialText?: string;
  }>();
  const router = useRouter();
  const listRef = useRef<FlatList<PendingMessage>>(null);

  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [initialTextConsumed, setInitialTextConsumed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const loadConversation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!id) {
        const conversations = await supportService.getMyConversations();

        if (conversations?.length) {
          const data = await supportService.getConversationById(conversations[0].id);
          setConversation(data);
          return;
        }

        const created = await supportService.createConversation({
          subject: 'Demande de support',
          category: 'OTHER',
        });
        setConversation(created);
        setInputText('Bonjour, j’ai besoin d’aide.');
        return;
      }

      const data = await supportService.getConversationById(id);
      setConversation(data);
    } catch (e: any) {
      setError(e.message ?? 'Impossible de charger la conversation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (initialText && !inputText && !initialTextConsumed) {
      setInputText(initialText);
      setInitialTextConsumed(true);
    }
  }, [initialText, inputText, initialTextConsumed]);

  // Socket.IO : réception des messages en temps réel (agent) 
  const handleIncomingMessage = useCallback((message: SupportMessage) => {
    setConversation((prev) => {
      if (!prev) return prev;

      const alreadyExists = prev.messages?.some((m) => m.id === message.id);
      if (alreadyExists) return prev;

      return {
        ...prev,
        messages: [...(prev.messages ?? []), message],
        last_message_at: message.created_at,
      };
    });
  }, []);

  useSupportSocket({
    conversationId: id ?? '',
    onNewMessage: handleIncomingMessage,
  });

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || sending || !id) return;

    const isFirstMessage = conversation?.messages?.length === 0;

    setSending(true);
    setInputText('');

    const tempId = `temp-${Date.now()}`;
    const tempMessage: PendingMessage = {
      id: tempId,
      conversation_id: id,
      sender_type: 'CUSTOMER',
      sender_id: '',
      content,
      attachments: [],
      created_at: new Date().toISOString(),
      _pending: true,
    };

    setConversation((prev) =>
      prev ? { ...prev, messages: [...(prev.messages ?? []), tempMessage] } : prev
    );

    try {
      const message = await supportService.sendMessage(id, { content });
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              subject: isFirstMessage ? content : prev.subject,
              messages: prev.messages?.map((m) => (m.id === tempId ? message : m)),
            }
          : prev
      );
    } catch (e: any) {
      setConversation((prev) =>
        prev ? { ...prev, messages: prev.messages?.filter((m) => m.id !== tempId) } : prev
      );
      setInputText(content);
      Alert.alert('Erreur', e.message ?? "Le message n'a pas pu être envoyé");
    } finally {
      setSending(false);
      setInitialTextConsumed(true);
    }
  };

  if (!fontsLoaded) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !conversation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.centered}>
          <Feather name="alert-circle" size={40} color={RED} />
          <Text style={styles.errorText}>{error ?? 'Conversation introuvable'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadConversation}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = STATUS_CONFIG[(conversation.status as ConversationStatus) ?? 'OPEN'] ?? {
    label: 'Inconnu',
    color: '#64748B',
  };
  const isClosed = (conversation.status ?? 'OPEN') === 'CLOSED';
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.filter((message, index, self) =>
        self.findIndex((m) => m?.id === message?.id) === index
      )
    : [];

  const renderMessage = ({ item, index }: { item: PendingMessage; index: number }) => {
    const isCustomer = item?.sender_type === 'CUSTOMER';
    const prevMessage = messages?.[index - 1];
    const itemDate = item?.created_at ?? new Date().toISOString();
    const showDateSeparator =
      !prevMessage ||
      new Date(prevMessage.created_at).toDateString() !== new Date(itemDate).toDateString();

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{formatDateSeparator(itemDate)}</Text>
          </View>
        )}
        <View style={[styles.bubbleRow, isCustomer ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
          <View
            style={[
              styles.bubble,
              isCustomer ? styles.bubbleCustomer : styles.bubbleAgent,
              item._pending && styles.bubblePending,
            ]}
          >
            <Text style={[styles.bubbleText, isCustomer && styles.bubbleTextCustomer]}>
              {item?.content ?? ''}
            </Text>
            <View style={styles.bubbleFooter}>
              <Text style={[styles.bubbleTime, isCustomer && styles.bubbleTimeCustomer]}>
                {formatTime(itemDate)}
              </Text>
              {item._pending && (
                <Feather name="clock" size={11} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color="#1a1a1a" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {conversation.subject ?? 'Conversation'}
            </Text>
            <View style={styles.headerMetaRow}>
              <Text style={styles.headerCategory}>{CATEGORY_LABELS[(conversation.category as SupportCategory) ?? 'OTHER'] ?? 'Autre'}</Text>
              <View style={styles.dot} />
              <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
              <Text style={[styles.headerStatus, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>
        </View>

        {conversation.assigned_agent && (
          <View style={styles.agentBanner}>
            <Feather name="user-check" size={14} color={RED} />
            <Text style={styles.agentBannerText}>
              Pris en charge par {conversation.assigned_agent.full_name}
            </Text>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Aucun message pour le moment</Text>
              <Text style={styles.emptySubtext}>Besoin d'aide ? Lance une nouvelle discussion.</Text>
            </View>
          )}
        />

        {/* Input */}
        {isClosed ? (
          <View style={styles.closedBanner}>
            <Feather name="lock" size={16} color="#94A3B8" />
            <Text style={styles.closedBannerText}>Cette conversation est fermée</Text>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Écrivez votre message..."
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#475569',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: RED,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: { marginRight: 12, padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#1a1a1a' },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  headerCategory: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1', marginHorizontal: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  headerStatus: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  agentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  agentBannerText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: RED },

  messagesList: { padding: 16, paddingBottom: 8 },

  dateSeparator: { alignItems: 'center', marginVertical: 12 },
  dateSeparatorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#94A3B8',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },

  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleCustomer: { backgroundColor: RED, borderBottomRightRadius: 4 },
  bubbleAgent: {
    backgroundColor: '#F8F9FB',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  bubblePending: { opacity: 0.6 },

  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1a1a1a', lineHeight: 20 },
  bubbleTextCustomer: { color: '#FFFFFF' },

  bubbleFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
  bubbleTime: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#94A3B8' },
  bubbleTimeCustomer: { color: 'rgba(255,255,255,0.75)' },

  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#F1F5F9',
    borderTopWidth: 1,
    borderTopColor: '#EEF0F3',
  },
  closedBannerText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#94A3B8' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#F5A9A6' },

  emptyText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#111827', marginTop: 12, textAlign: 'center' },
  emptySubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 4,
    textAlign: 'center',
  },
});