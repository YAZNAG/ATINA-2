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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_500Medium,
  Poppins_400Regular
} from '@expo-google-fonts/poppins';
import supportService, {
  SupportConversation,
  SupportMessage,
} from '../../services/support.service';
import { useSupportSocket } from '../../hooks/useSupportSocket';
import PageHeader from '@/components/ui/PageHeader';

const RED = '#E10600';

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


function buildWelcomeMessages(conversationId: string, customerName?: string): PendingMessage[] {
  const greeting = customerName ? `Bonjour ${customerName} ! 👋` : 'Bonjour ! 👋';
  const now = new Date().toISOString();
  return [
    {
      id: 'welcome-1',
      conversation_id: conversationId,
      sender_type: 'AGENT',
      sender_id: 'system',
      content: greeting,
      attachments: [],
      created_at: now,
    },
    {
      id: 'welcome-2',
      conversation_id: conversationId,
      sender_type: 'AGENT',
      sender_id: 'system',
      content: "Bienvenue sur le support El Herri. Comment puis-je vous aider aujourd'hui ?",
      attachments: [],
      created_at: now,
    },
  ];
}

export default function ChatScreen() {
  const { id, initialText, customerName } = useLocalSearchParams<{
    id?: string;
    initialText?: string;
    customerName?: string;
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
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const loadConversation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!id) {
        const conversations = await supportService.getMyConversations();

        if (conversations?.length) {
          const data = await supportService.getConversationById(conversations[0].id);
          setConversation(withWelcomeIfEmpty(data));
          return;
        }

        const created = await supportService.createConversation({
          subject: 'Demande de support',
          category: 'OTHER',
        });
        setConversation(withWelcomeIfEmpty(created));
        setInputText('Bonjour, j’ai besoin d’aide.');
        return;
      }

      const data = await supportService.getConversationById(id);
      setConversation(withWelcomeIfEmpty(data));
    } catch (e: any) {
      setError(e.message ?? 'Impossible de charger la conversation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const withWelcomeIfEmpty = (data: SupportConversation): SupportConversation => {
    if (data?.messages && data.messages.length > 0) return data;
    return {
      ...data,
      messages: buildWelcomeMessages(data.id, customerName),
    };
  };

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (initialText && !inputText && !initialTextConsumed) {
      setInputText(initialText);
      setInitialTextConsumed(true);
    }
  }, [initialText, inputText, initialTextConsumed]);

  // reception des messages en temps reel (agent)
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

    const isFirstMessage = conversation?.messages?.every((m) => m.id.startsWith('welcome-'));

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

  const handleAttach = () => {
    // TODO: brancher le picker de fichiers
  };

  const handleCamera = () => {
    // TODO: brancher la caméra / galerie
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
    const isFirstInGroup = showDateSeparator || prevMessage?.sender_type !== item?.sender_type;

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{formatDateSeparator(itemDate)}</Text>
          </View>
        )}
        <View style={[styles.bubbleRow, isCustomer ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
          {!isCustomer && (
            <View style={styles.avatarSlot}>
              {isFirstInGroup && (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>EH</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.bubbleCol}>
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
            </View>
            <View style={[styles.bubbleFooter, isCustomer ? styles.bubbleFooterRight : styles.bubbleFooterLeft]}>
              {isCustomer && (
                <MaterialCommunityIcons
                  name={item._pending ? 'clock-outline' : 'check-all'}
                  size={14}
                  color={item._pending ? '#94A3B8' : '#34B7F1'}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={styles.bubbleTime}>{formatTime(itemDate)}</Text>
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
        <PageHeader title='Support El Herri'/>

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
            <TouchableOpacity onPress={handleAttach} style={styles.iconButton}>
              <Feather name="paperclip" size={20} color="#6B7280" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Écrivez votre message..."
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
            />

            <TouchableOpacity onPress={handleCamera} style={styles.iconButton}>
              <Feather name="camera" size={20} color="#6B7280" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather
                  name="send"
                  size={17}
                  color={!inputText.trim() ? '#9CA3AF' : '#FFFFFF'}
                />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 32;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: {
    fontFamily: 'Poppins_500Medium',
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
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDEAEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'Poppins_700Bold',
    fontSize: 21,
    color: '#1a1a1a',
  },
  menuButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messagesList: { padding: 16, paddingBottom: 8 },

  dateSeparator: { alignItems: 'center', marginVertical: 16 },
  dateSeparatorText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#6A7282',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },

  bubbleRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },

  avatarSlot: {
    width: AVATAR_SIZE,
    marginRight: 8,
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#FDEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: RED,
  },

  bubbleCol: { maxWidth: '76%' },

  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleCustomer: { backgroundColor: RED, borderBottomRightRadius: 4 },
  bubbleAgent: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EEF0F3',
  },
  bubblePending: { opacity: 0.6 },

  bubbleText: { fontFamily: 'Poppins_400Regular', fontSize: 15, color: '#1a1a1a', lineHeight: 21 },
  bubbleTextCustomer: { color: '#FFFFFF' },

  bubbleFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  bubbleFooterLeft: { justifyContent: 'flex-start' },
  bubbleFooterRight: { justifyContent: 'flex-end' },
  bubbleTime: { fontFamily: 'Poppins_500Medium', fontSize: 11, color: '#99A1AF' },

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
  closedBannerText: { fontFamily: 'Poppins_500Medium', fontSize: 13, color: '#94A3B8' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#E5E7EB' },

  emptyText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#111827', marginTop: 12, textAlign: 'center' },
  emptySubtext: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 4,
    textAlign: 'center',
  },
});