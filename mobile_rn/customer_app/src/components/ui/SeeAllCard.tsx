import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

const RED = '#E10600';
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; 

export default function SeeAllCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconCircle}>
        <Feather name="arrow-right" size={22} color={RED} />
      </View>
      <Text style={styles.text}>Voir tout</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFF5F5',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFE1E1',
    minHeight: 260, 
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  text: { fontSize: 13, fontFamily: 'Inter_700Bold', color: RED },
});