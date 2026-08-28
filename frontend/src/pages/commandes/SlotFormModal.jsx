import { useState } from 'react';
import './DeliverySlots.css';

const DOW_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];


export default function SlotFormModal({
  dateKey,
  dayOfWeek,
  daySlots,
  daySource,
  onClose,
  onCreateRecurring,
  onCreateException,
  onUpdateSlot,
  onDeleteSlot,
}) {
  const [mode, setMode] = useState('exception'); // 'exception' | 'recurring'
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('11:00');
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const prettyDate = new Date(`${dateKey}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const resetForm = () => {
    setStart('09:00');
    setEnd('11:00');
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (start >= end) return;
    setBusy(true);
    try {
      if (editingId) {
        await onUpdateSlot(editingId, { slot_start: start, slot_end: end });
      } else if (mode === 'recurring') {
        await onCreateRecurring({ day_of_week: dayOfWeek, slot_start: start, slot_end: end });
      } else {
        await onCreateException({
          specific_date: dateKey,
          slot_start: start,
          slot_end: end,
          is_closed: false,
        });
      }
      resetForm();
    } finally {
      setBusy(false);
    }
  };

  const handleCloseDay = async () => {
    setBusy(true);
    try {
      await onCreateException({ specific_date: dateKey, is_closed: true });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (slot) => {
    setEditingId(slot.id);
    setStart(slot.start);
    setEnd(slot.end);
  };

  return (
    <div className="dsp-modal-overlay" onClick={onClose}>
      <div className="dsp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dsp-modal-header">
          <div>
            <h3>{prettyDate}</h3>
            <span className="dsp-modal-subtitle">
              {daySource === 'exception' ? 'Exception ponctuelle' : `Récurrent (${DOW_LABELS[dayOfWeek]})`}
            </span>
          </div>
          <button className="dsp-icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="dsp-modal-body">
          <div className="dsp-existing-slots">
            {daySlots.length === 0 && <p className="dsp-empty-hint">Aucun créneau ce jour.</p>}
            {daySlots.map((slot) => (
              <div key={slot.id} className="dsp-slot-row">
                <span>
                  {slot.start} – {slot.end}
                </span>
                <div className="dsp-slot-row-actions">
                  <button type="button" onClick={() => startEdit(slot)}>
                    Modifier
                  </button>
                  <button type="button" className="dsp-danger" onClick={() => onDeleteSlot(slot.id)}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="dsp-slot-form">
            {!editingId && (
              <div className="dsp-mode-toggle">
                <button
                  type="button"
                  className={mode === 'exception' ? 'active' : ''}
                  onClick={() => setMode('exception')}
                >
                  Ce jour uniquement
                </button>
                <button
                  type="button"
                  className={mode === 'recurring' ? 'active' : ''}
                  onClick={() => setMode('recurring')}
                >
                  Tous les {DOW_LABELS[dayOfWeek]}
                </button>
              </div>
            )}

            <div className="dsp-time-inputs">
              <label>
                Début
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
              </label>
              <label>
                Fin
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </label>
            </div>

            <div className="dsp-modal-actions">
              {editingId && (
                <button type="button" onClick={resetForm} className="dsp-secondary-btn">
                  Annuler
                </button>
              )}
              <button type="submit" className="dsp-primary-btn" disabled={busy}>
                {editingId ? 'Enregistrer' : 'Ajouter le créneau'}
              </button>
            </div>
          </form>

          <button type="button" className="dsp-close-day-btn" onClick={handleCloseDay} disabled={busy}>
            Marquer ce jour comme fermé (aucun créneau)
          </button>
        </div>
      </div>
    </div>
  );
}