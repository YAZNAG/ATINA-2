import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getOrderConfigs, saveOrderConfig, deleteOrderConfig, seedOrderConfigs } from '../../api/orders.api';
import { getNodes } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  node:  'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  seed:  'M4 16s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 12v4',
  gear:  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  check: 'M5 13l4 4L19 7',
  globe: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const RULE_KEYS = [
  { key: 'min_order_amount',  type: 'number',  icon: '💰', label: 'Montant minimum commande', unit: 'DH',      desc: 'Montant minimum pour passer commande' },
  { key: 'delivery_fee',      type: 'number',  icon: '🚚', label: 'Frais de livraison',        unit: 'DH',      desc: 'Frais ajoutés automatiquement' },
  { key: 'cod_max_amount',    type: 'number',  icon: '💵', label: 'Montant maximum COD',        unit: 'DH',      desc: 'Plafond pour paiement à la livraison' },
  { key: 'slot_duration_min', type: 'number',  icon: '⏱', label: 'Durée créneau',              unit: 'min',     desc: 'Durée d\'un créneau de livraison' },
  { key: 'maintenance_mode',  type: 'boolean', icon: '🔧', label: 'Mode maintenance',           unit: '',        desc: 'Désactive les commandes temporairement' },
];

export default function NodeOrderRulesPage() {
  const [nodes, setNodes]       = useState([]);
  const [nodeId, setNodeId]     = useState('');         // '' = global
  const [globalCfg, setGlobalCfg] = useState({});
  const [nodeCfg, setNodeCfg]   = useState({});
  const [editing, setEditing]   = useState({});         // key → temp value
  const [saving, setSaving]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [seeding, setSeeding]   = useState(false);

  useEffect(() => {
    getNodes({ all: true, limit: 500 }).then(r => setNodes(r.data?.data ?? r.data ?? [])).catch(() => {});
  }, []);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const keys = RULE_KEYS.map(r => r.key).join(',');
      const [globalRes] = await Promise.all([
        getOrderConfigs({ node_id: 'null', keys }),
      ]);
      const toMap = (arr) => Object.fromEntries((arr ?? []).map(c => [c.config_key, c]));
      setGlobalCfg(toMap(globalRes.data?.data ?? globalRes.data ?? []));

      if (nodeId) {
        const nodeRes = await getOrderConfigs({ node_id: nodeId, keys });
        setNodeCfg(toMap(nodeRes.data?.data ?? nodeRes.data ?? []));
      } else {
        setNodeCfg({});
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [nodeId]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const effectiveValue = (key) => {
    const nc = nodeCfg[key];
    const gc = globalCfg[key];
    return nc?.config_value ?? gc?.config_value ?? '';
  };

  const isOverridden = (key) => !!nodeCfg[key];

  const startEdit = (key) => {
    setEditing(e => ({ ...e, [key]: effectiveValue(key) }));
  };

  const handleSave = async (key, type) => {
    const value = editing[key];
    if (value === undefined || value === '') return;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await saveOrderConfig({ node_id: nodeId || null, config_key: key, config_value: value, value_type_code: type });
      toast.success('Configuration enregistrée');
      setEditing(e => { const n = { ...e }; delete n[key]; return n; });
      await loadConfigs();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(s => ({ ...s, [key]: false })); }
  };

  const handleRemoveOverride = async (key) => {
    const cfg = nodeCfg[key];
    if (!cfg) return;
    try {
      await deleteOrderConfig(cfg.id);
      toast.success('Override supprimé — valeur globale restaurée');
      await loadConfigs();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try { await seedOrderConfigs(); toast.success('Configurations globales seedées'); loadConfigs(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSeeding(false); }
  };

  const selectedNode = nodes.find(n => n.id === nodeId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Paramétrage</span><span>›</span><span>Commandes</span><span>›</span>
                <span className="text-violet-600 font-medium">Règles par node</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Règles commande par node</h1>
              <p className="text-sm text-gray-400 mt-0.5">Montant min, frais livraison, COD, créneaux, maintenance — globaux ou par node</p>
            </div>
            <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl disabled:opacity-50 flex-shrink-0">
              <Icon d={SVG.seed} className="w-4 h-4" />{seeding ? 'Seed…' : 'Seed globaux'}
            </button>
          </div>

          {/* Scope selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold uppercase tracking-wide">Scope :</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setNodeId('')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!nodeId ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-600 hover:border-violet-300'}`}>
                <Icon d={SVG.globe} className="w-3.5 h-3.5" />Global
              </button>
              {nodes.map(n => (
                <button key={n.id} onClick={() => setNodeId(n.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${nodeId === n.id ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-600 hover:border-violet-300'}`}>
                  <Icon d={SVG.node} className="w-3.5 h-3.5" />{n.code}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : (
          <>
            {nodeId && (
              <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl text-sm">
                <Icon d={SVG.node} className="w-4 h-4 text-violet-500" />
                <span className="font-semibold text-violet-800">{selectedNode?.name_fr}</span>
                <span className="text-violet-500 text-xs">— Les valeurs remplacent les globaux</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {RULE_KEYS.map(({ key, type, icon, label, unit, desc }) => {
                const val     = effectiveValue(key);
                const isOver  = nodeId && isOverridden(key);
                const isGlobal = nodeId && !isOverridden(key);
                const inEdit  = key in editing;

                return (
                  <div key={key} className={`bg-white rounded-2xl border shadow-sm p-5 ${isOver ? 'border-violet-200 ring-1 ring-violet-100' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{icon}</span>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm leading-tight">{label}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
                        </div>
                      </div>
                      {nodeId && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isOver ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                          {isOver ? 'Override' : 'Global'}
                        </span>
                      )}
                    </div>

                    {inEdit ? (
                      <div className="flex items-center gap-2 mt-2">
                        {type === 'boolean' ? (
                          <div className="flex gap-2 flex-1">
                            {['true','false'].map(v => (
                              <button key={v} type="button" onClick={() => setEditing(e => ({ ...e, [key]: v }))}
                                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${editing[key] === v ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-600 hover:border-violet-300'}`}>
                                {v === 'true' ? '✓ Activé' : '✕ Désactivé'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input type="number" value={editing[key]}
                            onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value })}
                            className="flex-1 px-3 py-2 text-sm border border-violet-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
                        )}
                        <button onClick={() => handleSave(key, type)} disabled={saving[key]}
                          className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50">
                          {saving[key] ? '…' : '✓'}
                        </button>
                        <button onClick={() => setEditing(e => { const n = { ...e }; delete n[key]; return n; })}
                          className="px-2 py-2 border border-gray-200 text-gray-500 text-xs rounded-xl hover:bg-gray-50">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          {type === 'boolean' ? (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${val === 'true' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                              {val === 'true' ? '✓ Activé' : '✕ Désactivé'}
                            </span>
                          ) : (
                            <span className="text-2xl font-bold text-gray-900">{val || '—'}<span className="text-sm font-medium text-gray-400 ml-1">{unit}</span></span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(key)} className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg" title="Modifier">
                            <Icon d={SVG.gear} className="w-4 h-4" />
                          </button>
                          {isOver && (
                            <button onClick={() => handleRemoveOverride(key)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Supprimer override">
                              <Icon d={SVG.trash} className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {isGlobal && (
                      <p className="text-[10px] text-gray-400 mt-2">Valeur globale · Cliquez modifier pour créer un override node</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
