export const Icon = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
  </svg>
);

export const I = {
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  plus: 'M12 4v16m8-8H4',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.5-9.5a2.121 2.121 0 013 3L12 16l-4 1 1-4 9.5-9.5z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16',
  toggleOn: 'M8 12a4 4 0 108 0 4 4 0 00-8 0zM6 6h12a6 6 0 010 12H6A6 6 0 016 6z',
  toggleOff: 'M16 12a4 4 0 11-8 0 4 4 0 018 0zM6 6h12a6 6 0 010 12H6A6 6 0 016 6z',
  restore: 'M4 4v6h6M4 10a8 8 0 1010-9.9',
  x: 'M6 18L18 6M6 6l12 12',
};

export function StatusBadge({ status, deleted }) {
  if (deleted) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">Supprimé</span>;
  if (status === 'active') return <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Actif</span>;
  return <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">Inactif</span>;
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}
        className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-40 hover:bg-zinc-700">
        Précédent
      </button>
      <span className="text-xs text-zinc-500">Page {page} / {pages}</span>
      <button disabled={page >= pages} onClick={() => onChange(page + 1)}
        className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-40 hover:bg-zinc-700">
        Suivant
      </button>
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Confirmer', danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-xs rounded-lg text-zinc-300 hover:bg-zinc-800">Annuler</button>
          <button onClick={onConfirm}
            className={`px-4 py-2 text-xs rounded-lg text-white font-medium ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}