import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import { getAppInfo, AppInfo } from '../../services/appInfo.service';
import { t } from '../../i18n';

const PRIMARY_RED = '#E10600';

export default function ContactUsScreen() {
  const router = useRouter();

  // Coordonnées du support paramétrées dans le back-office (Paramètres › app_configs).
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => { getAppInfo().then(setInfo).catch(() => setInfo(null)); }, []);

  const phone = info?.support_phone ?? null;
  const whatsapp = info?.support_whatsapp ?? null;
  const email = info?.support_email ?? null;
  const digits = (v: string) => v.replace(/[^\d+]/g, '');

  const handleCall = () => phone && Linking.openURL(`tel:${digits(phone)}`);
  const handleWhatsApp = () => whatsapp && Linking.openURL(`https://wa.me/${digits(whatsapp).replace(/^\+/, '')}`);
  const handleEmail = () => email && Linking.openURL(`mailto:${email}`);
  const handleSupport = () => {
    router.push('/support/conversations');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <PageHeader title={t('Contactez-nous')} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!info && (
          <Text style={styles.helpSubtitle}>{t('Chargement des coordonnées…')}</Text>
        )}

        {/* Téléphone */}
        {!!phone && (
          <ContactCard
            iconBg="#FDEAEA"
            icon={<Feather name="phone" size={22} color="#E10600" />}
            label={t('Téléphone')}
            value={phone}
            buttonLabel={t('Appeler')}
            buttonBg="#FBD9D9"
            buttonTextColor="#E10600"
            onPress={handleCall}
          />
        )}

        {/* WhatsApp */}
        {!!whatsapp && (
          <ContactCard
            iconBg="#E4F7EC"
            icon={<MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />}
            label={t('WhatsApp')}
            value={whatsapp}
            buttonLabel={t('Envoyer un message')}
            buttonBg="#D3F3E0"
            buttonTextColor="#1F9254"
            onPress={handleWhatsApp}
          />
        )}

        {/* Email */}
        {!!email && (
          <ContactCard
            iconBg="#E8EFFD"
            icon={<Feather name="mail" size={22} color="#3B6FE0" />}
            label={t('Email')}
            value={email}
            buttonLabel={t('Envoyer un email')}
            buttonBg="#E3ECFD"
            buttonTextColor="#3B6FE0"
            onPress={handleEmail}
          />
        )}

        {/* Need Help banner */}
        <View style={styles.helpBanner}>
          <Text style={styles.helpTitle}>{t('Besoin d\'aide ?')}</Text>
          <Text style={styles.helpSubtitle}>
            {t('Notre équipe est prête à vous accompagner dans chaque étape de votre commande.')}
          </Text>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={handleSupport}
            activeOpacity={0.85}
          >
            <Text style={styles.supportButtonText}>{t('Contacter le support')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

interface ContactCardProps {
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  buttonLabel: string;
  buttonBg: string;
  buttonTextColor: string;
  onPress: () => void;
}

function ContactCard({
  iconBg,
  icon,
  label,
  value,
  buttonLabel,
  buttonBg,
  buttonTextColor,
  onPress,
}: ContactCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.cardValue}>{value}</Text>
      </View>
      <TouchableOpacity
        style={[styles.cardButton, { backgroundColor: buttonBg }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.cardButtonText, { color: buttonTextColor }]}>
          {buttonLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTop: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardLabel: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9A9A9E',
  },
  cardButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cardButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
helpBanner: {
    backgroundColor: PRIMARY_RED,
    borderRadius: 28,
    padding: 24,
    marginTop: 6,
    marginBottom: 24,
  },
  helpTitle: {
    fontSize: 42,
    fontFamily: 'Poppins_700Bold',
    color: '#FFC6BD',
    marginBottom: 10,
  },
  helpSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    lineHeight: 25,
    color: '#FFD9D4',
    marginBottom: 24,
  },
  supportButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  supportButtonText: {
    color: PRIMARY_RED,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  socialLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.5,
    color: '#9A9A9E',
    marginBottom: 12,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  socialButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
});