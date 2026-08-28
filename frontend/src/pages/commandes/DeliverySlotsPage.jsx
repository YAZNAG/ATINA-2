import { useEffect, useMemo, useState } from 'react';
import {
  getNodes,
  getNodeSlotsCalendar,
  createNodeSlot,
  createSlotException,
  updateSlot,
  deleteSlot,
} from '../../api/locationNode.api';
import SlotFormModal from './SlotFormModal';
import './DeliverySlots.css';

const WEEKDAY_HEADERS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

const formatMonthLabel = (date) =>
  date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());

const formatTime = (t) => (t ? t.slice(0, 5) : '');

// Clé locale AAAA-MM-JJ pour comparer une date au jour courant.
const toDateKey = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Construit la grille du mois (semaines commençant le lundi), avec des
// cases vides avant/après pour aligner les colonnes LUN..DIM.
const buildMonthGrid = (year, month) => {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay(): 0=Dim..6=Sam -> on veut 0=Lun..6=Dim
  const jsDow = firstOfMonth.getUTCDay();
  const leadingBlanks = (jsDow + 6) % 7;

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

export default function DeliverySlotsPage() {
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [days, setDays] = useState([]); // depuis getNodeSlotsCalendar
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filters, setFilters] = useState({ showOpen: true, showClosed: false });
  const [activeCell, setActiveCell] = useState(null); // dateKey sélectionnée pour la modal

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  // Charge la liste des nodes une fois
  useEffect(() => {
    getNodes({ type: 'DARK_STORE' })
      .then((res) => {
        const list = res.data?.data || res.data || [];
        setNodes(list);
        if (list.length > 0) setSelectedNodeId(list[0].id);
      })
      .catch(() => setNodes([]));
  }, []);

  const loadCalendar = () => {
    if (!selectedNodeId) return;
    setLoading(true);
    getNodeSlotsCalendar(selectedNodeId, cursor.year, cursor.month)
      .then((res) => {
        const data = res.data?.data || res.data;
        setDays(data.days || []);
        setLastUpdated(new Date());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId, cursor.year, cursor.month]);

  const daysByDate = useMemo(() => {
    const map = {};
    for (const day of days) map[day.date] = day;
    return map;
  }, [days]);

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const goToMonth = (delta) => {
    setCursor((prev) => {
      let month = prev.month + delta;
      let year = prev.year;
      if (month < 1) {
        month = 12;
        year -= 1;
      } else if (month > 12) {
        month = 1;
        year += 1;
      }
      return { year, month };
    });
  };

  const dateKeyFor = (day) => {
    const mm = String(cursor.month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${cursor.year}-${mm}-${dd}`;
  };

  const activeDayData = activeCell ? daysByDate[activeCell] : null;
  const activeDow = activeCell ? new Date(`${activeCell}T00:00:00`).getDay() : null;

  const closeModal = () => setActiveCell(null);

  const handleCreateRecurring = async (payload) => {
    await createNodeSlot(selectedNodeId, payload);
    await loadCalendar();
  };

  const handleCreateException = async (payload) => {
    await createSlotException(selectedNodeId, payload);
    await loadCalendar();
  };

  const handleUpdateSlot = async (id, payload) => {
    await updateSlot(id, payload);
    await loadCalendar();
  };

  const handleDeleteSlot = async (id) => {
    await deleteSlot(id);
    await loadCalendar();
  };

  return (
    <div className="dsp-page">
      <div className="dsp-header">
        <h1>Créneaux de livraison</h1>
        {lastUpdated && (
          <span className="dsp-updated">
            <span className="dsp-dot" /> Mis à jour à{' '}
            {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="dsp-toolbar">
        <div className="dsp-node-select">
          <span className="dsp-dot dsp-dot-green" />
          <select
            value={selectedNodeId ?? ''}
            onChange={(e) => setSelectedNodeId(e.target.value)}
          >
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.code ? `${node.code} — ${node.name_fr}` : node.name_fr}
              </option>
            ))}
          </select>
        </div>

        <div className="dsp-month-nav">
          <button onClick={() => goToMonth(-1)} aria-label="Mois précédent">
            ◄
          </button>
          <span className="dsp-month-label">{formatMonthLabel(new Date(cursor.year, cursor.month - 1, 1))}</span>
          <button onClick={() => goToMonth(1)} aria-label="Mois suivant">
            ►
          </button>
        </div>

        <div className="dsp-legend">
          <label>
            <input
              type="checkbox"
              checked={filters.showOpen}
              onChange={(e) => setFilters((f) => ({ ...f, showOpen: e.target.checked }))}
            />
            Créneaux ouverts
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.showClosed}
              onChange={(e) => setFilters((f) => ({ ...f, showClosed: e.target.checked }))}
            />
            Aucun créneau ouvert
          </label>
        </div>
      </div>

      <div className={`dsp-calendar ${loading ? 'dsp-calendar-loading' : ''}`}>
        <div className="dsp-calendar-header-row">
          {WEEKDAY_HEADERS.map((label) => (
            <div key={label} className="dsp-weekday-header">
              {label}
            </div>
          ))}
        </div>

        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="dsp-week-row">
            {week.map((day, dIdx) => {
              if (day === null) return <div key={dIdx} className="dsp-day-cell dsp-day-cell-empty" />;

              const dateKey = dateKeyFor(day);
              const dayData = daysByDate[dateKey];
              const slots = dayData?.slots || [];
              const isClosed = dayData?.isClosed;
              const hasSlots = slots.length > 0;
              const isToday = dateKey === todayKey;

              const dimmed =
                (hasSlots && !filters.showOpen) || ((isClosed || !hasSlots) && !filters.showClosed && isClosed);

              return (
                <button
                  key={dIdx}
                  className={`dsp-day-cell ${isToday ? 'dsp-day-today' : ''} ${hasSlots ? 'dsp-day-has-slots' : ''} ${
                    isClosed ? 'dsp-day-closed' : ''
                  } ${dimmed ? 'dsp-day-dimmed' : ''}`}
                  onClick={() => setActiveCell(dateKey)}
                >
                  <span className="dsp-day-number">{day}</span>
                  {hasSlots ? (
                    <>
                      <span className="dsp-slot-badge">
                        {slots.length} créneau{slots.length > 1 ? 'x' : ''}
                      </span>
                      <span className="dsp-slot-times">
                        {slots
                          .slice(0, 2)
                          .map((s) => `${formatTime(s.start)}-${formatTime(s.end)}`)
                          .join(' · ')}
                        {slots.length > 2 ? ' ...' : ''}
                      </span>
                    </>
                  ) : isClosed ? (
                    <span className="dsp-closed-label">Fermé</span>
                  ) : (
                    <span className="dsp-no-slot">—</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {activeCell && (
        <SlotFormModal
          dateKey={activeCell}
          dayOfWeek={activeDow}
          daySlots={activeDayData?.slots || []}
          daySource={activeDayData?.source || 'recurring'}
          onClose={closeModal}
          onCreateRecurring={handleCreateRecurring}
          onCreateException={handleCreateException}
          onUpdateSlot={handleUpdateSlot}
          onDeleteSlot={handleDeleteSlot}
        />
      )}
    </div>
  );
}