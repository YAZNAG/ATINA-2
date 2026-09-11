import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, PowerOff, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';

/* Petits utilitaires partagés par les écrans « Codes Promo » et « Flash Sales ». */

export const apiError = (err, fallback = 'Une erreur est survenue') =>
  err?.response?.data?.message ?? err?.message ?? fallback;

export function money(n) {
  if (n === null || n === undefined || n === '') return '—';
  return `${Number(n).toFixed(2)} MAD`;
}

export function formatDate(d, withTime = true) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return withTime
    ? date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('fr-FR');
}

/** Date → valeur d'un <input type="datetime-local"> (heure locale). */
export function toLocalInput(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Valeur d'un <input type="datetime-local"> → ISO. */
export function fromLocalInput(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Export CSV côté client (séparateur « ; », BOM UTF-8). */
export function exportCsv(filename, headers, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[";\n\r]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))];
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

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-neutral-200">
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              isActive ? 'border-red-600 text-red-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Notice({ tone = 'amber', children }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
    zinc: 'border-zinc-200 bg-zinc-50 text-zinc-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return <div className={`rounded-lg border px-3 py-2 text-sm ${tones[tone] ?? tones.amber}`}>{children}</div>;
}

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Fenêtre de suppression protégée (WF #33 / WF #34) :
 *  - si des commandes actives (ou des utilisations) bloquent → message, compteur, liste filtrée et « Désactiver à la place » ;
 *  - sinon → confirmation du soft-delete.
 */
export function DeleteGuardModal({
  open, onClose, title, label, loading, check, busy, error, onConfirm, onDeactivate, canDeactivate = true,
}) {
  const blocked = check && !check.can_delete;
  const orders = check?.active_orders ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={label}
      size="md"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>
          {blocked && canDeactivate && onDeactivate && (
            <button type="button" className={primaryBtn} disabled={busy} onClick={onDeactivate}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <PowerOff size={16} />} Désactiver à la place
            </button>
          )}
          {check && !blocked && (
            <button type="button" className="btn-danger" disabled={busy} onClick={onConfirm}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Confirmer la suppression
            </button>
          )}
        </>
      )}
    >
      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 size={16} className="animate-spin" /> Vérification des commandes liées…</div>
      )}
      {error && <Notice tone="red">{error}</Notice>}
      {check && blocked && (
        <div className="space-y-3">
          <Notice tone="red">
            <div className="flex gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><span>{check.reason}</span></div>
          </Notice>
          {orders.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">
                Commandes actives concernées ({check.active_orders_count}) :
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border border-neutral-200">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                    <tr>
                      <th className="px-3 py-2 text-left">N° commande</th>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-left">Statut</th>
                      <th className="px-3 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {orders.map((o) => (
                      <tr key={o.order_id}>
                        <td className="px-3 py-2 font-medium text-red-600">{o.order_number}</td>
                        <td className="px-3 py-2">{o.customer_name ?? '—'}</td>
                        <td className="px-3 py-2">{o.status_label ?? o.status_code}</td>
                        <td className="px-3 py-2 text-xs text-neutral-500">{formatDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link to="/orders-mgmt" className="mt-2 inline-block text-xs font-medium text-red-600 hover:underline">
                Ouvrir la liste des commandes →
              </Link>
            </div>
          )}
          <p className="text-xs text-neutral-500">
            La désactivation arrête immédiatement l'offre côté client ; les commandes en cours se terminent normalement.
            La suppression redeviendra possible une fois ces commandes livrées, annulées ou retournées.
          </p>
        </div>
      )}
      {check && !blocked && (
        <p className="text-sm text-neutral-700">
          Aucune commande active n'est liée. La suppression est un <strong>soft-delete</strong> : l'élément disparaît des listes
          actives mais reste consultable dans l'historique. Cette action est définitive (pas de réactivation possible).
        </p>
      )}
    </Modal>
  );
}
