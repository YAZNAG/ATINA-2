// Libellés, règles d'affichage et utilitaires partagés — Offres > Gamification.

export const GAME_STATUS = {
  running: { label: 'En cours', cls: 'bg-emerald-50 text-emerald-700' },
  scheduled: { label: 'Programmé', cls: 'bg-sky-50 text-sky-700' },
  inactive: { label: 'Inactif', cls: 'bg-gray-100 text-gray-600' },
  ended: { label: 'Terminé', cls: 'bg-zinc-200 text-zinc-600' },
};

export const STATUS_FILTERS = [
  { value: '', label: 'Tous statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'running', label: 'En cours' },
  { value: 'scheduled', label: 'Programmé' },
  { value: 'ended', label: 'Terminé' },
];

export const CLAIM_STATUS = {
  claimed: { label: 'Réclamé', cls: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  expired: { label: 'Expiré', cls: 'bg-gray-100 text-gray-500' },
};

// Matrice condition × période × quota × seuil (US-079 section B) — miroir de gamification.rules.js
export const CONDITION_RULES = {
  first_order: { periods: ['lifetime'], fixedMaxPlays: 1, minAmount: false },
  order_delivered: { periods: ['lifetime', 'daily', 'weekly', 'monthly'], fixedMaxPlays: null, minAmount: true },
  signup: { periods: ['lifetime'], fixedMaxPlays: 1, minAmount: false },
  app_login: { periods: ['daily', 'weekly', 'monthly'], fixedMaxPlays: 1, minAmount: false },
};

export const CONDITION_HELP = {
  first_order: "Un tour à la toute première commande du client (acquisition). Période « À vie » et 1 partie imposées.",
  order_delivered: "Un tour quand la commande est LIVRÉE ET ENCAISSÉE et que son montant atteint le seuil (facultatif : vide ou 0 = aucun seuil, comparaison ≥).",
  signup: "Un tour dès la vérification du numéro par OTP, sans achat. À réserver aux lots de faible valeur. Période « À vie » et 1 partie imposées.",
  app_login: "Un tour à la première ouverture authentifiée de l'app dans la période (rétention). La période porte le rythme : quotidien, hebdomadaire ou mensuel. « À vie » est interdit.",
};

export const PERIOD_HELP = {
  lifetime: 'Jamais de remise à zéro.',
  daily: 'Remise à zéro chaque nuit à minuit (Africa/Casablanca).',
  weekly: 'Remise à zéro chaque lundi (Africa/Casablanca).',
  monthly: 'Remise à zéro le 1er de chaque mois (Africa/Casablanca).',
};

export const PRIZE_COLORS = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
export const NO_PRIZE_COLOR = '#d4d4d8';

export function errMsg(err, fallback = 'Une erreur est survenue') {
  return err?.response?.data?.message ?? err?.message ?? fallback;
}

export function fmtDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR');
}

/** Date → valeur d'un <input type="datetime-local"> (heure locale). */
export function toLocalInput(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function money(n) {
  if (n === null || n === undefined || n === '') return '—';
  return `${Number(n).toFixed(2)} MAD`;
}

/** Description courte de la valeur d'un lot. */
export function prizeValueLabel(p) {
  const code = p.prize_type_code ?? p.prize_type?.code;
  switch (code) {
    case 'points': return `${p.value ?? '—'} points`;
    case 'coupon': {
      const promo = p.coupon_promo_type?.code ?? p.coupon_promo_type_code;
      const v = promo === 'PERCENTAGE' ? `-${p.value}%` : `-${Number(p.value ?? 0).toFixed(2)} MAD`;
      return `${p.coupon_code_prefix ?? ''}… ${v} · ${p.coupon_validity_days ?? 30} j${Number(p.coupon_min_order_amount) > 0 ? ` · min ${money(p.coupon_min_order_amount)}` : ''}`;
    }
    case 'free_sku': return p.sku_label ?? 'SKU offert';
    case 'free_pack': return p.pack_label ?? 'Pack offert';
    case 'no_prize': return 'Aucun gain';
    default: return '—';
  }
}

/** Poids normalisés en % (lots actifs uniquement). */
export function normalizedPct(prizes) {
  const sum = prizes.filter((p) => p.is_active).reduce((s, p) => s + Number(p.probability_weight || 0), 0);
  return prizes.map((p) => (p.is_active && sum > 0 ? Math.round((Number(p.probability_weight) / sum) * 10000) / 100 : 0));
}

/** Export CSV côté client (séparateur « ; », BOM UTF-8). */
export function downloadCsv(filename, columns, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(';')];
  rows.forEach((r) => lines.push(columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(';')));
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
