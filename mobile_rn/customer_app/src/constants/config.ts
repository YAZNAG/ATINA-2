// Backend hébergé par défaut (APK et mises à jour EAS) ; surcharger avec EXPO_PUBLIC_API_URL en développement local.
export const CONFIG = {
  API_URL:     process.env.EXPO_PUBLIC_API_URL     ?? 'https://atina2.atina.ma/api',
  STORAGE_URL: process.env.EXPO_PUBLIC_STORAGE_URL ?? 'https://atina2.atina.ma',
  TIMEOUT: 10000,
};
