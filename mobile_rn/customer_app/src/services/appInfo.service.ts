import { Linking } from 'react-native';
import api from '../api/client';

/** Contacts et liens légaux paramétrés dans le back-office (app_configs). */
export interface AppInfo {
  support_phone:    string | null;
  support_whatsapp: string | null;
  support_email:    string | null;
  cgu_url:          string | null;
  privacy_url:      string | null;
  default_currency: string | null;
  default_timezone: string | null;
}

let cache: Promise<AppInfo> | null = null;

export function getAppInfo(): Promise<AppInfo> {
  if (!cache) {
    cache = api.get('/customer/app-info')
      .then((r) => r.data.data as AppInfo)
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}

/** Ouvre les CGU ou la politique de confidentialité (URL définie dans le back-office). */
export async function openLegal(kind: 'cgu' | 'privacy'): Promise<boolean> {
  try {
    const info = await getAppInfo();
    const url = kind === 'cgu' ? info.cgu_url : info.privacy_url;
    if (!url) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
