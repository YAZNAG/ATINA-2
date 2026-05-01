export function AddIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m-7-7h14" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function DeleteIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6h18M8 6V4h8v2m-1 0v13a2 2 0 01-2 2h-2a2 2 0 01-2-2V6h6z" />
    </svg>
  );
}

export function EditButton({ onClick, label = 'Modifier' }) {
  return (
    <button type="button" onClick={onClick} className="btn-icon-edit">
      <EditIcon />
      {label}
    </button>
  );
}

export function DeleteButton({ onClick, label = 'Supprimer' }) {
  return (
    <button type="button" onClick={onClick} className="btn-icon-delete">
      <DeleteIcon />
      {label}
    </button>
  );
}
