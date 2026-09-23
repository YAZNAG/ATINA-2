import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { Feather } from '@expo/vector-icons';
import { t } from '../i18n';

const RED = '#E10600';
/** L'app s'ouvre d'abord : la recherche de mise à jour attend le premier écran. */
const START_DELAY_MS = 4000;

/**
 * Mises à jour à distance (EAS Update), sans bloquer l'ouverture de l'app :
 * la vérification démarre quelques secondes après le lancement, la nouvelle version
 * est téléchargée en tâche de fond, puis un bandeau discret propose de l'appliquer.
 * Sans action, elle s'appliquera d'elle-même au prochain démarrage.
 * Inactif en développement (Expo Go / Metro) et en version web.
 */
export default function AppUpdater() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const busy = useRef(false);
  const dismissedAt = useRef(0);

  const check = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || busy.current) return;
    // « Plus tard » : ne pas redemander avant 30 minutes
    if (Date.now() - dismissedAt.current < 30 * 60 * 1000) return;
    busy.current = true;
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        await Updates.fetchUpdateAsync();   // téléchargement silencieux
        setReady(true);
      }
    } catch {
      /* hors ligne ou serveur indisponible : on réessaiera au prochain retour */
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(check, START_DELAY_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, [check]);

  const apply = async () => {
    setRestarting(true);
    try { await Updates.reloadAsync(); } catch { setRestarting(false); }
  };

  if (!ready) return null;

  return (
    <View style={[styles.bar, { bottom: insets.bottom + 92 }]} pointerEvents="box-none">
      <View style={styles.card}>
        <Feather name="download-cloud" size={18} color={RED} />
        <Text style={styles.text} numberOfLines={2}>{t('Nouvelle version prête')}</Text>
        <TouchableOpacity style={styles.btn} onPress={apply} disabled={restarting} activeOpacity={0.85}>
          {restarting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnText}>{t('Redémarrer')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { dismissedAt.current = Date.now(); setReady(false); }}
          hitSlop={10}
          accessibilityLabel={t('Fermer')}
        >
          <Feather name="x" size={16} color="#8A8A8A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch',
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  text: { flex: 1, fontSize: 13.5, color: '#0A0A0A', fontFamily: 'Inter_600SemiBold' },
  btn: { backgroundColor: RED, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
