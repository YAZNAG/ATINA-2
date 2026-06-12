import {
  View, Text, Image, StyleSheet,
  Dimensions, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function Slide3() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/auth/login')}>
        <Text style={styles.skipText}>Ignorer</Text>
      </TouchableOpacity>

      <Image
        source={require('../../../assets/images/app/onboarding3.png')}
        style={styles.image}
        resizeMode="contain"
      />

      <View style={styles.textContainer}>
        <Text style={styles.title}>Livraison ou retrait en magasin</Text>
        <Text style={styles.description}>
          Choisissez le jour et le créneau horaire qui vous conviennent, selon votre disponibilité.
        </Text>
      </View>

      <View style={styles.dotsContainer}>
        <View style={[styles.dot, styles.dotInactive]} />
        <View style={[styles.dot, styles.dotInactive]} />
        <View style={[styles.dot, styles.dotActive]} />
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.replace('/auth/login')}>
        <Text style={styles.buttonText}>Commencer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center' },
  skipButton: { alignSelf: 'flex-end', paddingTop: 30,paddingRight: 30, fontFamily: 'Inter_600SemiBold', },
  skipText: { color: '#E10600', fontSize: 16, fontWeight: '500' },
  image: { width: width * 0.7, height: height * 0.4, marginTop: 16 },
  textContainer: { alignItems: 'center', paddingHorizontal: 24, marginTop: 32 },
  title: { fontSize: 28 , color: '#0A0A0A', textAlign: 'center', marginBottom: 12, fontFamily: 'Inter_800ExtraBold' , marginHorizontal: 40 },
  description: { fontSize: 15, color: '#8A8A8A', textAlign: 'center', lineHeight: 22 ,fontFamily: 'Inter_400Regular',marginHorizontal: 8},
  dotsContainer: { flexDirection: 'row', marginTop: 44, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
  dotActive: { backgroundColor: '#E10600', width: 24 },
  dotInactive: { backgroundColor: '#F5F5F5' },
  button: { backgroundColor: '#E10600', width: width -70, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 40, marginHorizontal: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});