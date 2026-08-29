import { useEffect, useMemo, useState } from 'react';
import { getNodes, getNodeSlotsCalendar } from '../../api/locationNode.api';
import SlotFormPanel from './SlotFormModal';
import './DeliverySlots.css';

const WEEKDAY_HEADERS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

const formatMonthLabel = (date) =>
  date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());

// Clé locale AAAA-MM-JJ pour comparer une date au jour courant.
const toDateKey = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// slot_start/slot_end peuvent arriver en DateTime ISO ou en "HH:MM"
const formatSlotTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : String(value);
};

// Construit la grille du mois (semaines commençant le lundi), avec des
// cases vides avant/après pour aligner les colonnes LUN..DIM.
const buildMonthGrid = (year, month) => {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const jsDow = firstOfMonth.getUTCDay(); // 0=Dim..6=Sam -> on veut 0=Lun..6=Dim
  const leadingBlanks = (jsDow + 6) % 7;

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
};

const MAX_VISIBLE_SLOTS = 2;

export default function DeliverySlotsPage() {
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [days, setDays] = useState({}); // { 'YYYY-MM-DD': [{ start, end, is_active }] }
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeCell, setActiveCell] = useState(null); // dateKey sélectionnée pour le panneau

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
        setDays(data.days || {});
        setLastUpdated(new Date());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId, cursor.year, cursor.month]);

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

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

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
              const daySlots = days[dateKey] || [];
              const hasSlots = daySlots.length > 0;
              const isToday = dateKey === todayKey;
              const visibleSlots = daySlots.slice(0, MAX_VISIBLE_SLOTS);
              const extraCount = daySlots.length - visibleSlots.length;

              return (
                <button
                  key={dIdx}
                  className={`dsp-day-cell ${isToday ? 'dsp-day-today' : ''} ${hasSlots ? 'dsp-day-has-slots' : ''}`}
                  onClick={() => setActiveCell(dateKey)}
                >
                  <span className="dsp-day-number">{day}</span>

                  {hasSlots ? (
                    <>
                      {visibleSlots.map((slot, sIdx) => (
                        <span
                          key={sIdx}
                          className={`dsp-slot-badge ${!slot.is_active ? 'dsp-slot-badge-inactive' : ''}`}
                        >
                          {formatSlotTime(slot.start)}–{formatSlotTime(slot.end)}
                          {!slot.is_active && ' · Inactif'}
                        </span>
                      ))}
                      {extraCount > 0 && <span className="dsp-slot-more">+{extraCount}</span>}
                    </>
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
        <SlotFormPanel
          nodeId={selectedNodeId}
          nodeLabel={selectedNode ? (selectedNode.code || selectedNode.name_fr) : ''}
          dateKey={activeCell}
          onClose={() => setActiveCell(null)}
          onChanged={loadCalendar}
        />
      )}
    </div>
  );
}