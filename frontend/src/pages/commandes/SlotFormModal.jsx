import { useEffect, useState } from 'react';
import { getNodeSlots, createNodeSlot, updateSlot, deleteSlot } from '../../api/locationNode.api';
import './DeliverySlots.css';

export default function SlotFormPanel({ nodeId, nodeLabel, dateKey, onClose, onChanged }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('11:00');
  const [maxOrders, setMaxOrders] = useState('20');

  const prettyDate = new Date(`${dateKey}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const load = () => {
    setLoading(true);
    getNodeSlots(nodeId, dateKey)
      .then((res) => {
        const data = res.data?.data || res.data;
        setSlots(data.slots || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, dateKey]);

  const notifyChanged = () => {
    onChanged?.();
    load();
  };

  const handleToggle = async (slot) => {
    setBusy(true);
    try {
      await updateSlot(slot.id, { is_active: !slot.is_active });
      notifyChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (slot) => {
    setBusy(true);
    try {
      await deleteSlot(slot.id);
      notifyChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (start >= end) return;
    setBusy(true);
    try {
      await createNodeSlot(nodeId, {
        specific_date: dateKey,
        slot_start: start,
        slot_end: end,
        max_orders: Number(maxOrders),
      });
      setStart('09:00');
      setEnd('11:00');
      setMaxOrders('20');
      notifyChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dsp-modal-overlay" onClick={onClose}>
      <div className="dsp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dsp-modal-header">
          <div>
            <h3>{prettyDate}</h3>
            <span className="dsp-modal-subtitle">
              {nodeLabel ? `Nœud ${nodeLabel}` : 'Nœud'} — {slots.length} créneau{slots.length !== 1 ? 'x' : ''} ouvert{slots.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button className="dsp-icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="dsp-modal-body">
          <div className="dsp-section-label">Créneaux du jour</div>

          <div className="dsp-existing-slots">
            {loading && <p className="dsp-empty-hint">Chargement…</p>}
            {!loading && slots.length === 0 && <p className="dsp-empty-hint">Aucun créneau ce jour.</p>}
            {slots.map((slot) => {
              const pct = slot.max_orders ? Math.min(100, (slot.reservations / slot.max_orders) * 100) : 0;
              return (
                <div key={slot.id} className="dsp-slot-card">
                  <div className="dsp-slot-card-top">
                    <span className="dsp-slot-time">
                      {slot.start} à {slot.end}
                    </span>
                    <div className="dsp-slot-card-actions">
                      <label className="dsp-toggle">
                        <input
                          type="checkbox"
                          checked={slot.is_active}
                          disabled={busy}
                          onChange={() => handleToggle(slot)}
                        />
                        <span className="dsp-toggle-track" />
                      </label>
                      <button
                        type="button"
                        className="dsp-icon-btn dsp-danger"
                        disabled={busy}
                        onClick={() => handleDelete(slot)}
                        aria-label="Supprimer"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <div className="dsp-slot-card-meta">
                    Capacité {slot.max_orders} · Réservations <strong>{slot.reservations}</strong>
                  </div>
                  <div className="dsp-progress-track">
                    <div className="dsp-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="dsp-section-label">Ajouter un créneau</div>

          <form onSubmit={handleSubmit} className="dsp-slot-form">
            <div className="dsp-time-inputs">
              <label>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
              </label>
              <span className="dsp-time-sep">à</span>
              <label>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </label>
            </div>

            <label className="dsp-max-orders-field">
              Capacité max :
              <input
                type="number"
                min="0"
                value={maxOrders}
                onChange={(e) => setMaxOrders(e.target.value)}
                required
              />
              commandes
            </label>

            <button type="submit" className="dsp-primary-btn dsp-primary-btn-full" disabled={busy}>
              + Ajouter le créneau
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}