import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { CONFIG } from '../constants/config';
import { getNodeId } from '../store/nodePref';

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL ?? CONFIG.API_URL).replace(/\/api\/?$/, '');

/** Événement diffusé par le backend quand la disponibilité d'un pack change (WF #23, US-102). */
export interface PackAvailabilityEvent {
  pack_id:          string;
  node_id:          string | null;
  is_available:     boolean;
  is_active:        boolean;
  is_deleted:       boolean;
  remaining_cap:    number | null;
  assemblable_count: number | null;
}

/**
 * Abonnement temps réel à /socket/packs : le client rejoint la room de son point de
 * distribution et reçoit 'pack:availability' sans recharger l'écran.
 */
export function usePackAvailability(onEvent: (e: PackAvailabilityEvent) => void, enabled = true) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const socket = io(SOCKET_URL, { path: '/socket/packs', transports: ['websocket', 'polling'] });
    socket.on('connect', async () => {
      const nodeId = await getNodeId();
      if (nodeId) socket.emit('join_node', nodeId);
    });
    socket.on('pack:availability', (e: PackAvailabilityEvent) => {
      if (alive) handler.current(e);
    });
    return () => { alive = false; socket.disconnect(); };
  }, [enabled]);
}
