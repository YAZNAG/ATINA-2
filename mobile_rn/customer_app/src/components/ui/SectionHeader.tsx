import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const RED = '#E10600';

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
}

export default function SectionHeader({ title, onSeeAll }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>Voir tout</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, marginBottom: 12,
  },
  title:   { fontSize: 17, color: '#1a1a1a', fontFamily: 'Poppins_700Bold' },
  seeAll:  { fontSize: 13, color: RED, fontFamily: 'Poppins_600SemiBold' },
});