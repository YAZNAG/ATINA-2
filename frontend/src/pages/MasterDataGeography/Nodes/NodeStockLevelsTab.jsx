import NodeRelationTable from './NodeRelationTable';
import { getStockLevels } from '../../../api/stock.api';

export default function NodeStockLevelsTab({ nodeId }) {
  const columns = [
    { key: 'sku', label: 'SKU', render: (s) => s.sku?.code || s.sku?.sku_code || s.sku_id },
    { key: 'article', label: 'Article', render: (s) => s.sku?.name_fr || s.sku?.article?.name_fr || '—' },
    { key: 'qty_physical', label: 'Physique' },
    { key: 'qty_reserved', label: 'Réservé' },
    { key: 'qty_available', label: 'Disponible', render: (s) => (
      <span className={Number(s.qty_available) <= 0 ? 'font-medium text-[#E10600]' : ''}>{s.qty_available}</span>
    )},
    { key: 'qty_backordered', label: 'Backorder' },
    { key: 'qty_incoming', label: 'Entrant' },
    { key: 'last_counted_at', label: 'Dernier inventaire', render: (s) => s.last_counted_at ? new Date(s.last_counted_at).toLocaleDateString('fr-FR') : '—' },
  ];

  return (
    <NodeRelationTable
      fetchFn={() => getStockLevels({ node_id: nodeId, limit: 10 }).then((r) => r.data)}
      columns={columns}
      emptyLabel="Aucun niveau de stock enregistré pour ce node."
      viewAllHref={`/stock/levels?node_id=${nodeId}`}
      viewAllLabel="Voir le stock complet →"
    />
  );
}