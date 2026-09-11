import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import { Feather } from '@expo/vector-icons';

const RED = '#E10600';

/**
 * Mises à jour à distance (EAS Update) : au lancement et à chaque retour de l'app au
 * premier plan, vérifie si une nouvelle version du code a été publiée sur le canal de
 * l'APK. Si oui, affiche « Mise à jour disponible » ; « Mettre à jour » télécharge la
 * version puis redémarre l'app dessus, sans réinstaller d'APK.
 * Inactif en développement (Expo Go / Metro) et en version web.
 */
export default function AppUpdater() {
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<'idle' | 'downloading' | 'error'>('idle');
  const checking = useRef(false);
  const dismissedAt = useRef(0);

  const check = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || checking.current) return;
    // « Plus tard » : ne pas redemander avant 30 minutes
    if (Date.now() - dismissedAt.current < 30 * 60 * 1000) return;
    checking.current = true;
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) { setState('idle'); setVisible(true); }
    } catch {
      /* hors ligne ou serveur indisponible : on réessaiera au prochain retour */
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
  }, [check]);

  const apply = async () => {
    setState('downloading');
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setState('error');
    }
  };

  const later = () => { dismissedAt.current = Date.now(); setVisible(false); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={later}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="download-cloud" size={30} color={RED} />
          </View>
          <Text style={styles.title}>Mise à jour disponible</Text>
          <Text style={styles.body}>
            {state === 'error'
              ? 'Le téléchargement a échoué. Vérifiez votre connexion puis réessayez.'
              : "Une nouvelle version d'Atina est prête. L'application redémarre en quelques secondes."}
          </Text>
          <TouchableOpacity
            style={[styles.primary, state === 'downloading' && { opacity: 0.8 }]}
            onPress={apply}
            disabled={state === 'downloading'}
            activeOpacity={0.85}
          >
            {state === 'downloading'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryText}>{state === 'error' ? 'Réessayer' : 'Mettre à jour'}</Text>}
          </TouchableOpacity>
          {state !== 'downloading' && (
            <TouchableOpacity onPress={later} hitSlop={10}>
              <Text style={styles.later}>Plus tard</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,10,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 18, padding: 24, alignItems: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 18, color: '#0A0A0A', fontFamily: 'Poppins_700Bold', marginBottom: 6, textAlign: 'center' },
  body: { fontSize: 13.5, color: '#8A8A8A', fontFamily: 'Poppins_400Regular', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  primary: { alignSelf: 'stretch', backgroundColor: RED, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  primaryText: { color: '#fff', fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  later: { color: RED, fontSize: 14, fontFamily: 'Poppins_500Medium' },
});
