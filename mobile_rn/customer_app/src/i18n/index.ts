import { I18nManager, Platform, DevSettings } from 'react-native';
import * as Updates from 'expo-updates';
import { AR } from './ar';
import { LANG_KEY, Lang, prefGet, prefSet } from '../components/onboarding/onboardingKit';

/**
 * Traduction FR/AR de l'application (classeur : l'app client est bilingue, arabe en RTL).
 * La clé est le texte français ; sans traduction connue, le français est affiché.
 * La langue est lue au démarrage (initI18n) ; en changer recharge l'app pour basculer le sens RTL.
 */
let current: Lang = 'fr';

export function getLang(): Lang { return current; }
export function isRTL(): boolean { return current === 'ar'; }

/** t('Bonjour {name}', { name }) — placeholders {x} remplacés dans les deux langues. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let out = current === 'ar' ? (AR[fr] ?? fr) : fr;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Nom localisé d'une entité { name_fr, name_ar }. */
export function tName(o?: { name_fr?: string | null; name_ar?: string | null } | null): string {
  if (!o) return '';
  return (current === 'ar' && o.name_ar) ? o.name_ar : (o.name_fr ?? '');
}

/** Formats nombre / date selon la langue (chiffres latins conservés en arabe marocain). */
export function fmtNumber(n: number, digits = 2): string {
  return Number(n).toLocaleString(current === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-FR', {
    minimumFractionDigits: 0, maximumFractionDigits: digits,
  });
}
export function fmtDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' }): string {
  return new Date(d).toLocaleDateString(current === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-FR', opts);
}

async function applyDirection(lang: Lang): Promise<boolean> {
  const wantRTL = lang === 'ar';
  I18nManager.allowRTL(true);
  if (Platform.OS === 'web' || I18nManager.isRTL === wantRTL) return false;
  I18nManager.forceRTL(wantRTL);
  I18nManager.swapLeftAndRightInRTL(true);
  return true;
}

async function reloadApp() {
  try { await Updates.reloadAsync(); } catch { DevSettings.reload(); }
}

/**
 * À appeler une fois au démarrage, avant d'afficher les écrans. Ne lève jamais et ne
 * dépasse jamais 1,5 s : la langue ne doit pas pouvoir bloquer l'ouverture de l'app.
 */
export async function initI18n(): Promise<void> {
  try {
    const saved = await Promise.race([
      prefGet(LANG_KEY),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    current = saved === 'ar' ? 'ar' : 'fr';
    if (await applyDirection(current)) await reloadApp();
  } catch {
    current = 'fr';
  }
}

/** Change la langue : mémorise, bascule le sens d'écriture et recharge si nécessaire. */
export async function setLanguage(lang: Lang): Promise<void> {
  await prefSet(LANG_KEY, lang);
  const changed = lang !== current;
  current = lang;
  const dirChanged = await applyDirection(lang);
  if (changed || dirChanged) await reloadApp();
}

/**
 * Données serveur bilingues : en arabe, chaque champ « xxx_fr » est remplacé par « xxx_ar »
 * lorsqu'il est renseigné. Les écrans qui affichent name_fr montrent ainsi l'arabe.
 */
export function localizeData<T>(data: T): T {
  if (current !== 'ar' || data == null) return data;
  const seen = new WeakSet<object>();
  const walk = (v: any): any => {
    if (Array.isArray(v)) { v.forEach(walk); return v; }
    if (v && typeof v === 'object') {
      if (seen.has(v)) return v;
      seen.add(v);
      for (const key of Object.keys(v)) {
        const val = v[key];
        if (key.endsWith('_fr')) {
          const ar = v[`${key.slice(0, -3)}_ar`];
          if (typeof ar === 'string' && ar.trim()) v[key] = ar;
        } else if (val && typeof val === 'object') {
          walk(val);
        }
      }
    }
    return v;
  };
  return walk(data);
}
