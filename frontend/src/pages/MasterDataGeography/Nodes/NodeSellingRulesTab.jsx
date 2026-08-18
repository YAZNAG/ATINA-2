import NodeRelationTable from './NodeRelationTable';
import { getSellingRulesByNode } from '../../../api/stock.api';

export default function NodeSellingRulesTab({ nodeId }) {
  const columns = [
    { key: 'sku', label: 'SKU', render: (r) => r.sku?.code || r.sku?.sku_code || r.sku_id },
    { key: 'article', label: 'Article', render: (r) => r.sku?.name_fr || r.sku?.article?.name_fr || '—' },
    { key: 'backorderable', label: 'Backorder', render: (r) => (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.is_backorderable ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
        {r.is_backorderable ? 'Autorisé' : 'Bloqué'}
      </span>
    )},
    { key: 'backorder_limit', label: 'Limite' },
    { key: 'backordered_quantity', label: 'En attente' },
    { key: 'estimated_restock_days', label: 'Réappro (j)' },
  ];

  return (
    <NodeRelationTable
      fetchFn={() => getSellingRulesByNode(nodeId).then((r) => r.data)}
      columns={columns}
      emptyLabel="Aucune règle de vente configurée pour ce node."
      viewAllHref={`/stock/selling-rules?node_id=${nodeId}`}
      viewAllLabel="Voir toutes les règles →"
    />
  );
}