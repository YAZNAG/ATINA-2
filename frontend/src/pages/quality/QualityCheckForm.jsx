import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { createQualityCheck, getQualitySessionsLookup } from '../../api/quality.api';
import { getErrorMessage } from '../../utils/helpers';
import { sessionRef, orderRef, fmtDateTime } from '../picking/pickingUtils';

const EMPTY = { node_id: '', picking_session_id: '', order_id: '', check_type_id: '', result: 'ok', score: '', anomalies: '', notes: '' };

/** Création d'un contrôle qualité (US-069) : type, résultat OK/KO, score, anomalies, notes, référence session/commande. */
export default function QualityCheckForm({ open, onClose, onCreated, lookups, initialSession }) {
  const [form, setForm] = useState(EMPTY);
  const [sessions, setSessions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({ ...EMPTY, node_id: initialSession?.node_id ?? '', picking_session_id: initialSession?.id ?? '' });
  }, [open, initialSession]);

  useEffect(() => {
    if (!open) return;
    getQualitySessionsLookup(form.node_id ? { node_id: form.node_id } : {})
      .then((r) => {
        const list = r.data?.data ?? [];
        // La session pré-sélectionnée peut être plus ancienne que les 100 dernières
        if (initialSession && !list.some((s) => s.id === initialSession.id)) list.unshift(initialSession);
        setSessions(list);
      })
      .catch(() => setSessions(initialSession ? [initialSession] : []));
  }, [open, form.node_id, initialSession]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSessionChange = (id) => {
    const s = sessions.find((x) => x.id === id);
    setForm((f) => ({ ...f, picking_session_id: id, ...(s ? { node_id: s.node_id, order_id: '' } : {}) }));
  };

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!form.check_type_id) { setError('Sélectionnez le type de contrôle'); return; }
    if (!form.picking_session_id && !form.order_id.trim()) { setError('Indiquez la session de picking ou l\'identifiant de la commande contrôlée'); return; }
    if (form.result === 'ko' && !form.anomalies.trim()) { setError('Un contrôle KO doit décrire les anomalies constatées'); return; }
    if (form.score !== '' && (!Number.isInteger(Number(form.score)) || Number(form.score) < 0 || Number(form.score) > 100)) {
      setError('Le score doit être un entier entre 0 et 100'); return;
    }
    setSaving(true);
    try {
      const payload = {
        check_type_id: form.check_type_id,
        result: form.result,
        ...(form.node_id && { node_id: form.node_id }),
        ...(form.picking_session_id && { picking_session_id: form.picking_session_id }),
        ...(!form.picking_session_id && form.order_id.trim() && { order_id: form.order_id.trim() }),
        ...(form.score !== '' && { score: Number(form.score) }),
        anomalies: form.anomalies.trim() || null,
        notes: form.notes.trim() || null,
      };
      const r = await createQualityCheck(payload);
      onCreated?.(r.data?.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Nouveau contrôle qualité"
      subtitle="Traçabilité de la conformité avant livraison"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" form="qc-form" className="btn-danger" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le contrôle'}</button>
        </>
      )}
    >
      <form id="qc-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="form-label">Node</label>
          <select className="form-select" value={form.node_id} onChange={(e) => setForm((f) => ({ ...f, node_id: e.target.value, picking_session_id: '' }))}>
            <option value="">— Déduit de la référence —</option>
            {(lookups?.nodes ?? []).map((n) => <option key={n.id} value={n.id}>{n.code} · {n.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Type de contrôle *</label>
          <select className="form-select" value={form.check_type_id} onChange={(e) => set('check_type_id', e.target.value)} required>
            <option value="">— Sélectionner —</option>
            {(lookups?.types ?? []).map((t) => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="form-label">Session de picking contrôlée</label>
          <select className="form-select" value={form.picking_session_id} onChange={(e) => onSessionChange(e.target.value)}>
            <option value="">— Aucune (contrôle sur commande) —</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {sessionRef(s.id)} · {orderRef(s.order_id)} · {s.status?.name_fr ?? ''}{s.picker?.name ? ` · ${s.picker.name}` : ''} · {fmtDateTime(s.completed_at || s.created_at)}
              </option>
            ))}
          </select>
        </div>
        {!form.picking_session_id && (
          <div className="sm:col-span-2">
            <label className="form-label">Identifiant de la commande (UUID)</label>
            <input className="form-input font-mono" value={form.order_id} onChange={(e) => set('order_id', e.target.value)} placeholder="ex. 3f2c…" />
          </div>
        )}
        <div>
          <label className="form-label">Résultat *</label>
          <div className="flex gap-2">
            {[{ v: 'ok', l: 'OK — conforme', c: 'border-emerald-500 bg-emerald-50 text-emerald-700' }, { v: 'ko', l: 'KO — non conforme', c: 'border-rose-500 bg-rose-50 text-rose-700' }].map((o) => (
              <button key={o.v} type="button" onClick={() => set('result', o.v)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${form.result === o.v ? o.c : 'border-slate-200 text-slate-500'}`}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Score (0 – 100)</label>
          <input type="number" min="0" max="100" step="1" className="form-input" value={form.score} onChange={(e) => set('score', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="form-label">Anomalies constatées{form.result === 'ko' ? ' *' : ''}</label>
          <textarea className="form-textarea" value={form.anomalies} onChange={(e) => set('anomalies', e.target.value)} placeholder="Ex. article manquant, emballage abîmé, DLC dépassée…" />
        </div>
        <div className="sm:col-span-2">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">{error}</div>}
      </form>
    </Modal>
  );
}
