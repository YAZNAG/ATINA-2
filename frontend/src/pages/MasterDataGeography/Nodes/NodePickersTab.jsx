import NodeRelationTable from './NodeRelationTable';
import { getPickers } from '../../../api/staff.api';

export default function NodePickersTab({ nodeId }) {
  const columns = [
    { key: 'name', label: 'Nom' },
    { key: 'phone', label: 'Téléphone', render: (p) => `${p.phone_country}${p.phone_number}` },
    { key: 'status', label: 'Statut', render: (p) => (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
        {p.is_active ? 'Actif' : 'Inactif'}
      </span>
    )},
  ];

  return (
    <NodeRelationTable
      fetchFn={() => getPickers({ node_id: nodeId, limit: 10 }).then((r) => r.data.data)}
      columns={columns}
      emptyLabel="Aucun picker rattaché à ce node."
      viewAllHref={`/staff/pickers?node_id=${nodeId}`}
      viewAllLabel="Voir tous les pickers →"
    />
  );
}