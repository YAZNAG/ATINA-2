import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const RED = '#E10600';

interface PageHeaderProps {
  title:       string;
  onBack?:     () => void;           
  rightIcon?:  string;   
  rightText?: string;             
  onRightPress?: () => void;
  rightBadge?: number;                
}

export default function PageHeader({
  title, onBack, rightIcon, rightText, onRightPress, rightBadge,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      {/* ── Back button ── */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/main/main_nav/home');
           }
          }}
        activeOpacity={0.7}>
        <Feather name="chevron-left" size={20} color={RED} />
      </TouchableOpacity>

      {/* ── Title ── */}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      {/* ── Right slot ── */}
      {rightText ? (
  <TouchableOpacity onPress={onRightPress} activeOpacity={0.7}>
    <Text style={styles.markAllText}>{rightText}</Text>
  </TouchableOpacity>
) : rightIcon ? (
  <TouchableOpacity
    style={styles.rightBtn}
    onPress={onRightPress}
    activeOpacity={0.7}
  >
    <Feather name={rightIcon as any} size={20} color="#1a1a1a" />
    {rightBadge !== undefined && rightBadge > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {rightBadge > 9 ? '9+' : rightBadge}
        </Text>
      </View>
    )}
  </TouchableOpacity>
) : (
  <View style={{ width: 60 }} />
)}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFEAEA',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1, textAlign: 'left', marginLeft: 14,
    fontSize: 20, color: '#1a1a1a',
    fontFamily: 'Poppins_700Bold',
  },
  rightBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: { fontSize: 10, color: '#fff', fontFamily: 'Poppins_700Bold' },

  markAllText: { fontSize: 13, color: RED, fontWeight: '600', width: 60, textAlign: 'right' },
});