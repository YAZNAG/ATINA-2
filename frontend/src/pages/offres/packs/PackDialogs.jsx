import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Copy, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import { deletePack, deactivatePack, duplicatePack } from '../../../api/packs.api';
import { apiError, nodeLabel } from './packUi';

/**
 * « Dupliquer vers un node » (WF #22 / US-101) : copie inactive de la composition et des prix
 * sur le node cible ; avertissement si des SKU y sont manquants ou non vendables.
 */
export function DuplicatePackModal({ open, pack, nodes = [], onClose, onDuplicated, onOpenPack }) {
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) { setTarget(''); setError(null); setResult(null); }
  }, [open, pack?.id]);

  if (!open || !pack) return null;

  async function submit() {
    if (!target) { setError('Choisissez le node cible'); return; }
    setSaving(true);
    setError(null);
    try {
      const { data } = await duplicatePack(pack.id, target);
      setResult({ ...data.data, message: data.message });
      onDuplicated?.(data.data);
    } catch (err) {
      setError(apiError(err, 'Échec de la duplication'));
    } finally {
      setSaving(false);
    }
  }

  const footer = result ? (
    <>
      <button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>
      {onOpenPack && (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          onClick={() => onOpenPack(result.pack.id)}
        >
          Ouvrir la copie
        </button>
      )}
    </>
  ) : (
    <>
      <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
      <button
        type="button"
        onClick={submit}
        disabled={saving || !target}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        <Copy size={16} /> {saving ? 'Duplication…' : 'Dupliquer'}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title="Dupliquer vers un node" subtitle={pack.name_fr} footer={footer} size="sm">
      {!result ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            La composition (SKU et quantités) et les prix sont copiés <strong>tels quels</strong>. Le nouveau pack est
            créé <strong>inactif</strong> : vérifiez la composition, renseignez le plafond de vente et la vente en
            rupture, puis activez-le manuellement.
          </p>
          <div>
            <label className="form-label">Node cible *</label>
            <select className="form-select" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">— Choisir un node —</option>
              {nodes.filter((n) => n.id !== pack.node_id).map((n) => (
                <option key={n.id} value={n.id}>{nodeLabel(n)}</option>
              ))}
            </select>
          </div>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{result.message}</div>
          {result.warnings?.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              <p className="mb-2 flex items-center gap-2 font-medium">
                <AlertTriangle size={16} /> Composants indisponibles sur le node cible
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {result.warnings.map((w) => (
                  <li key={w.sku_id}>{w.sku_code} — {w.name_fr} : {w.reason}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Corrigez la composition avant d'activer le pack.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * Suppression (US-073) : soft-delete si aucune commande active n'utilise le pack ; sinon refus
 * avec le nombre de commandes et le bouton « Désactiver à la place ».
 */
export function DeletePackModal({ open, pack, canDeactivate, onClose, onDeleted, onDeactivated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [blocked, setBlocked] = useState(null);

  useEffect(() => {
    if (open) { setBusy(false); setError(null); setBlocked(null); }
  }, [open, pack?.id]);

  if (!open || !pack) return null;

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await deletePack(pack.id);
      onDeleted?.(pack.id);
      onClose?.();
    } catch (err) {
      const d = err?.response?.data;
      if (err?.response?.status === 409 && d?.data?.active_orders_count) {
        setBlocked({ message: d.message, count: d.data.active_orders_count, link: d.data.orders_link });
      } else {
        setError(apiError(err, 'Échec de la suppression'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function deactivateInstead() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await deactivatePack(pack.id);
      onDeactivated?.(data.data);
      onClose?.();
    } catch (err) {
      setError(apiError(err, 'Échec de la désactivation'));
    } finally {
      setBusy(false);
    }
  }

  const footer = blocked ? (
    <>
      <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Fermer</button>
      {canDeactivate && pack.is_active && (
        <button
          type="button"
          onClick={deactivateInstead}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? '…' : 'Désactiver à la place'}
        </button>
      )}
    </>
  ) : (
    <>
      <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Annuler</button>
      <button type="button" className="btn-danger" onClick={confirmDelete} disabled={busy}>
        <Trash2 size={16} /> {busy ? 'Suppression…' : 'Supprimer'}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title="Supprimer le pack" subtitle={pack.name_fr} footer={footer} size="sm">
      {!blocked ? (
        <p className="text-sm text-slate-600">
          Le pack sera retiré des offres (suppression logique : il reste consultable dans l'historique des commandes).
          Confirmer la suppression de « {pack.name_fr} » ?
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{blocked.message}</span>
          </div>
          {blocked.link && (
            <Link to={blocked.link} className="text-sm font-medium text-red-600 hover:underline">
              Voir les {blocked.count} commande(s) concernée(s)
            </Link>
          )}
          {!pack.is_active && <p className="text-slate-500">Le pack est déjà inactif : il n'est plus proposé aux clients.</p>}
        </div>
      )}
      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
    </Modal>
  );
}
