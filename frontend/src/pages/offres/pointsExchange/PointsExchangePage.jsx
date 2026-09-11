import { useEffect, useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getNodes } from '../../../api/locationNode.api';
import ExchangeRulesList from './ExchangeRulesList';
import ExchangeRuleForm from './ExchangeRuleForm';
import ExchangeSupervision from './ExchangeSupervision';

/**
 * Offres › Point Exchange — catalogue des SKU échangeables contre des points (modèle points-only).
 * Onglets : « Liste des SKUs échangeables » | « Configuration échange » | « Supervision des échanges ».
 */
const TABS = [
  { key: 'list',        label: 'Liste des SKUs échangeables' },
  { key: 'config',      label: 'Configuration échange' },
  { key: 'supervision', label: 'Supervision des échanges' },
];

export default function PointsExchangePage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('points_exchange.manage');
  const canView = canManage || hasPermission('points_exchange.view');

  const [activeTab, setActiveTab] = useState('list');
  const [ruleId, setRuleId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    getNodes({ limit: 500 })
      .then(({ data }) => setNodes(data.data ?? []))
      .catch(() => setNodes([]));
  }, []);

  function openRule(id) {
    setCreating(false);
    setRuleId(id);
    setActiveTab('config');
  }

  function openNew() {
    setRuleId(null);
    setCreating(true);
    setActiveTab('config');
  }

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page.</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Point Exchange</h1>
          <p className="page-subtitle">SKU échangeables contre des points de fidélité, configurés node par node.</p>
        </div>
        {canManage && (
          <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700">
            <Plus size={16} /> Ajouter SKU
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === t.key ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <ExchangeRulesList key={listKey} nodes={nodes} canManage={canManage} onEdit={openRule} onAdd={openNew} />
      )}

      {activeTab === 'config' && (
        (ruleId || (creating && canManage)) ? (
          <ExchangeRuleForm
            key={ruleId || 'new'}
            ruleId={ruleId}
            nodes={nodes}
            canManage={canManage}
            onOpenRule={openRule}
            onSaved={(rule, meta) => {
              setListKey((k) => k + 1);
              if (meta?.created && rule?.id) { setCreating(false); setRuleId(rule.id); }
            }}
          />
        ) : (
          <div className="card space-y-3 py-12 text-center text-sm text-slate-400">
            <p>Sélectionnez un SKU dans la « Liste des SKUs échangeables »{canManage ? ' ou ajoutez-en un' : ''}.</p>
            {canManage && (
              <button type="button" onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                <Plus size={16} /> Ajouter SKU
              </button>
            )}
          </div>
        )
      )}

      {activeTab === 'supervision' && <ExchangeSupervision nodes={nodes} />}
    </div>
  );
}
