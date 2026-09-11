import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import { getPickers, reassignPicker } from '../../api/picking.api';
import { getErrorMessage } from '../../utils/helpers';
import { sessionRef } from './pickingUtils';

/**
 * Réassignation du picker d'une session (US-067) : uniquement pickers actifs du node de la session,
 * tant que la session n'est pas terminée. L'action est auditée côté API.
 */
export default function ReassignPickerModal({ session, onClose, onDone }) {
  const [pickers, setPickers] = useState([]);
  const [pickerId, setPickerId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const nodeId = session?.node?.id ?? session?.node_id;

  useEffect(() => {
    if (!session) return;
    setPickerId(''); setReason(''); setError('');
    setLoading(true);
    getPickers({ node_id: nodeId })
      .then((r) => setPickers((r.data?.data ?? []).filter((p) => p.id !== session.picker?.id)))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [session, nodeId]);

  if (!session) return null;

  const submit = async () => {
    if (!pickerId) { setError('Sélectionnez le nouveau picker'); return; }
    setSaving(true); setError('');
    try {
      const r = await reassignPicker(session.id, pickerId, reason.trim() || undefined);
      toast.success(r.data?.message || 'Picker réassigné');
      onDone?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open={!!session}
      onClose={onClose}
      size="sm"
      title={session.picker ? 'Réassigner le picker' : 'Affecter un picker'}
      subtitle={`${sessionRef(session.id)} · ${session.node?.code ?? ''}`}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-danger" onClick={submit} disabled={saving || loading}>
            {saving ? 'Enregistrement…' : 'Réassigner'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Picker actuel : <strong className="text-slate-800">{session.picker?.name ?? 'Non assigné'}</strong>
        </div>
        <div>
          <label className="form-label">Nouveau picker (actifs du node)</label>
          {loading ? (
            <p className="text-sm text-slate-400">Chargement…</p>
          ) : pickers.length === 0 ? (
            <p className="text-sm text-amber-600">Aucun autre picker actif rattaché à ce node.</p>
          ) : (
            <select className="form-select" value={pickerId} onChange={(e) => setPickerId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {pickers.map((p) => <option key={p.id} value={p.id}>{p.name}{p.phone_number ? ` · ${p.phone_number}` : ''}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="form-label">Motif (optionnel, tracé dans l'audit)</label>
          <input className="form-input" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Ex. picker indisponible" />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </div>
    </Modal>
  );
}
