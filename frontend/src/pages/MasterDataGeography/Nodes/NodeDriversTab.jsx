import NodeRelationTable from './NodeRelationTable';
import { getDrivers } from '../../../api/staff.api';

export default function NodeDriversTab({ nodeId }) {
  const columns = [
    { key: 'name', label: 'Nom' },
    { key: 'phone', label: 'Téléphone', render: (d) => `${d.phone_country}${d.phone_number}` },
    { key: 'vehicle', label: 'Véhicule', render: (d) => [d.vehicle_type, d.vehicle_plate].filter(Boolean).join(' · ') || '—' },
    { key: 'status', label: 'Statut', render: (d) => (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${d.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
        {d.is_active ? 'Actif' : 'Inactif'}
      </span>
    )},
  ];

  return (
    <NodeRelationTable
      fetchFn={() => getDrivers({ node_id: nodeId, limit: 10 }).then((r) => r.data.data)}
      columns={columns}
      emptyLabel="Aucun livreur rattaché à ce node."
      viewAllHref={`/staff/drivers?node_id=${nodeId}`}
      viewAllLabel="Voir tous les livreurs →"
    />
  );
}