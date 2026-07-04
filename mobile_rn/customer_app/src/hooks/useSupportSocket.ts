import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { SupportMessage } from '../services/support.service';
import { getToken } from '../services/customer_auth.service';
import { CONFIG } from '../constants/config';

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL ?? CONFIG.API_URL)
  .replace(/\/api\/?$/, '');

interface UseSupportSocketParams {
  conversationId: string;
  onNewMessage: (message: SupportMessage) => void;
}

export function useSupportSocket({ conversationId, onNewMessage }: UseSupportSocketParams) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let isMounted = true;

    const connect = async () => {
      const token = await getToken();

      const socket = io(SOCKET_URL, {
        auth: { token },
        path: '/socket/support',
        transports: ['websocket', 'polling'],
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('join_conversation', { conversation_id: conversationId });
      });

      socket.on('support:new_message', (payload: { conversation_id: string; message: SupportMessage }) => {
        if (!isMounted) return;
        if (payload.conversation_id === conversationId) {
          onNewMessage(payload.message);
        }
      });

      socket.on('connect_error', (err) => {
        console.warn('Support socket connect_error:', err.message);
      });
    };

    connect();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.emit('leave_conversation', conversationId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [conversationId, onNewMessage]);
}