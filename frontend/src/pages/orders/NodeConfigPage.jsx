import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getOrderConfigs, saveOrderConfig, deleteOrderConfig, seedOrderConfigs } from '../../api/orders.api';
import { getDeliveryTypes } from '../../api/delivery.api';
import { getPaymentMethods } from '../../api/payment.api';
import { getNodes } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  node:   'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  globe:  'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
  truck:  'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  card:   'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  gear:   'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  seed:   'M4 16s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 12v4',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const TABS = [
  { id: 'delivery', label: 'Livraison',  icon: SVG.truck, color: 'blue'   },
  { id: 'payment',  label: 'Paiement',   icon: SVG.card,  color: 'emerald'},
  { id: 'rules',    label: 'Règles',     icon: SVG.gear,  color: 'violet' },
];

const TAB_COLOR = {
  blue:    { active: 'bg-blue-600 text-white',    ring: 'ring-blue-200',    toggle: 'bg-blue-500',    icon: 'text-blue-600',    iconbg: 'bg-blue-50',    border: 'border-blue-200',    bg: 'bg-blue-50'    },
  emerald: { active: 'bg-emerald-600 text-white', ring: 'ring-emerald-200', toggle: 'bg-emerald-500', icon: 'text-emerald-600', iconbg: 'bg-emerald-50', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  violet:  { active: 'bg-violet-600 text-white',  ring: 'ring-violet-200',  toggle: 'bg-violet-500',  icon: 'text-violet-600',  iconbg: 'bg-violet-50',  border: 'border-violet-200',  bg: 'bg-violet-50'  },
};

function Toggle({ active, onChange, disabled, color = 'emerald' }) {
  const clr = TAB_COLOR[color];
  return (
    <button type="button" disabled={disabled} onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-40 flex-shrink-0 ${active ? clr.toggle : 'bg-gray-300'}`}>
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function OverrideBadge({ isOver, color, onReset }) {
  if (!isOver) return null;
  const clr = TAB_COLOR[color];
  return (
    <div className="flex items-center gap-1">
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${clr.bg} ${clr.border} ${clr.icon}`}>Override</span>
      <button onClick={onReset} title="Réinitialiser vers global" className="text-red-400 hover:text-red-600">
        <Icon d={SVG.trash} className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── ORDER RULE KEYS ────────────────────────────────────────────────────────────
const RULE_KEYS = [
  { key: 'min_order_amount',  type: 'number',  emoji: '💰', label: 'Montant minimum commande', unit: 'DH',  desc: 'Montant minimum pour passer une commande' },
  { key: 'delivery_fee',      type: 'number',  emoji: '🚚', label: 'Frais de livraison',        unit: 'DH',  desc: 'Frais ajoutés automatiquement à chaque commande' },
  { key: 'cod_max_amount',    type: 'number',  emoji: '💵', label: 'Montant maximum COD',        unit: 'DH',  desc: 'Plafond pour paiement à la livraison' },
  { key: 'slot_duration_min', type: 'number',  emoji: '⏱', label: 'Durée créneau',              unit: 'min', desc: 'Durée d\'un créneau de livraison' },
  { key: 'maintenance_mode',  type: 'boolean', emoji: '🔧', label: 'Mode maintenance',           unit: '',    desc: 'Désactive temporairement les commandes sur ce node' },
];

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export default function NodeConfigPage() {
  const [nodes, setNodes]           = useState([]);
  const [nodeId, setNodeId]         = useState('');
  const [tab, setTab]               = useState('delivery');
  const [loading, setLoading]       = useState(false);

  // Data from global modules
  const [deliveryTypes, setDeliveryTypes] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // Configs from app_configs (global + node)
  const [globalCfg, setGlobalCfg] = useState({});
  const [nodeCfg, setNodeCfg]     = useState({});

  // Inline editing for rules
  const [editing, setEditing] = useState({});
  const [saving, setSaving]   = useState({});
  const [seeding, setSeeding] = useState(false);

  // Load nodes + global modules once
  useEffect(() => {
    getNodes({ all: true, limit: 500 }).then(r => setNodes(r.data?.data ?? r.data ?? [])).catch(() => {});
    getDeliveryTypes({ all: true }).then(r => setDeliveryTypes(r.data?.data ?? r.data ?? [])).catch(() => {});
    getPaymentMethods({ all: true }).then(r => setPaymentMethods(r.data?.data ?? r.data ?? [])).catch(() => {});
  }, []);

  // Load app_configs when node changes
  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const toMap = (arr) => Object.fromEntries((arr ?? []).map(c => [c.config_key, c]));
      const globalRes = await getOrderConfigs({ node_id: 'null' });
      setGlobalCfg(toMap(globalRes.data?.data ?? globalRes.data ?? []));
      if (nodeId) {
        const nodeRes = await getOrderConfigs({ node_id: nodeId });
        setNodeCfg(toMap(nodeRes.data?.data ?? nodeRes.data ?? []));
      } else {
        setNodeCfg({});
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [nodeId]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getCfgValue = (key, def = 'false') => {
    const nc = nodeCfg[key];
    const gc = globalCfg[key];
    return nc?.config_value ?? gc?.config_value ?? def;
  };

  const isOverridden = (key) => nodeId && !!nodeCfg[key];

  const handleToggle = async (key, currentStr, typeCode = 'boolean') => {
    const newVal = currentStr === 'true' ? 'false' : 'true';
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await saveOrderConfig({ node_id: nodeId || null, config_key: key, config_value: newVal, value_type_code: typeCode });
      await loadConfigs();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(s => ({ ...s, [key]: false })); }
  };

  const handleRemoveOverride = async (key) => {
    const cfg = nodeCfg[key];
    if (!cfg) return;
    try { await deleteOrderConfig(cfg.id); toast.success('Réinitialisé vers valeur globale'); await loadConfigs(); }
    catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleRuleSave = async (key, type) => {
    const value = editing[key];
    if (value === undefined || value === '') return;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await saveOrderConfig({ node_id: nodeId || null, config_key: key, config_value: value, value_type_code: type });
      setEditing(e => { const n = { ...e }; delete n[key]; return n; });
      await loadConfigs();
      toast.success('Enregistré');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(s => ({ ...s, [key]: false })); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try { await seedOrderConfigs(); toast.success('Valeurs globales initialisées'); loadConfigs(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSeeding(false); }
  };

  const selectedNode = nodes.find(n => n.id === nodeId);

  // ── Render ───────────────────────────────────────────────────────────────────

  const currentTab = TABS.find(t => t.id === tab);
  const clr = TAB_COLOR[currentTab?.color ?? 'blue'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Paramétrage</span><span>›</span><span>Commandes</span><span>›</span>
                <span className="text-slate-600 font-medium">Config par node</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Configuration par node</h1>
              <p className="text-sm text-gray-400 mt-0.5">Activer les types de livraison, méthodes de paiement et règles spécifiques à un node</p>
            </div>
            <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl disabled:opacity-50 flex-shrink-0">
              <Icon d={SVG.seed} className="w-4 h-4" />{seeding ? '…' : 'Init globaux'}
            </button>
          </div>

          {/* Node selector */}
          <div className="flex items-center gap-3 mb-4">
            <Icon d={SVG.node} className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select value={nodeId} onChange={e => setNodeId(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white min-w-[280px]">
              <option value="">— Global (tous les nodes) —</option>
              {nodes.map(n => <option key={n.id} value={n.id}>{n.name_fr} ({n.code})</option>)}
            </select>
            {nodeId && (
              <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-medium border border-slate-200">
                <Icon d={SVG.node} className="w-3 h-3" />{selectedNode?.code}
              </span>
            )}
            {!nodeId && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg font-medium border border-gray-200">
                <Icon d={SVG.globe} className="w-3 h-3" />Valeurs globales
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? TAB_COLOR[t.color].active + ' shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                <Icon d={t.icon} className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-${currentTab?.color}-600`} style={{ borderBottomColor: tab === 'delivery' ? '#2563eb' : tab === 'payment' ? '#059669' : '#7c3aed' }} />
          </div>
        ) : (

          <>
            {/* ── TAB: LIVRAISON ─────────────────────────────────────────────── */}
            {tab === 'delivery' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                  <Icon d={SVG.truck} className="w-4 h-4 text-blue-500" />
                  <span>Types de livraison définis dans <strong className="text-blue-600">Paramétrage Livraison</strong> — activez ceux disponibles pour ce node</span>
                </div>
                {deliveryTypes.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Aucun type de livraison — allez dans Paramétrage Livraison pour en créer</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {deliveryTypes.map(dt => {
                      const cfgKey = `delivery_type_${dt.code}`;
                      const valStr = getCfgValue(cfgKey, 'false');
                      const active = valStr === 'true';
                      const over   = isOverridden(cfgKey);
                      return (
                        <div key={dt.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${active ? 'border-blue-200 ring-2 ring-blue-100' : 'border-gray-100'}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl ${active ? 'bg-blue-50' : 'bg-gray-100'} flex items-center justify-center transition-colors`}>
                              <Icon d={SVG.truck} className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                            </div>
                            <OverrideBadge isOver={over} color="blue" onReset={() => handleRemoveOverride(cfgKey)} />
                          </div>
                          <p className="font-semibold text-gray-900 text-sm">{dt.name_fr}</p>
                          <p className="text-xs text-gray-400 mb-1" dir="rtl">{dt.name_ar}</p>
                          <p className="text-[11px] font-mono text-gray-400 mb-4 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 inline-block">{dt.code}</p>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-semibold ${active ? 'text-blue-600' : 'text-gray-400'}`}>{active ? 'Activé' : 'Désactivé'}</span>
                            <Toggle active={active} color="blue" disabled={saving[cfgKey]} onChange={() => handleToggle(cfgKey, valStr)} />
                          </div>
                          {nodeId && !over && <p className="text-[10px] text-gray-400 mt-2">Valeur globale · Toggle pour créer un override node</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: PAIEMENT ──────────────────────────────────────────────── */}
            {tab === 'payment' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                  <Icon d={SVG.card} className="w-4 h-4 text-emerald-500" />
                  <span>Méthodes définies dans <strong className="text-emerald-600">Paramétrage Paiement</strong> — activez celles acceptées par ce node</span>
                </div>
                {paymentMethods.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Aucune méthode de paiement — allez dans Paramétrage Paiement pour en créer</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {paymentMethods.map(pm => {
                      const cfgKey = `payment_method_${pm.code}`;
                      const valStr = getCfgValue(cfgKey, pm.code === 'cod' ? 'true' : 'false');
                      const active = valStr === 'true';
                      const over   = isOverridden(cfgKey);
                      return (
                        <div key={pm.id} className={`bg-white rounded-2xl border p-6 shadow-sm transition-all ${active ? 'border-emerald-200 ring-2 ring-emerald-100' : 'border-gray-200'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div className={`w-12 h-12 rounded-xl ${active ? 'bg-emerald-50' : 'bg-gray-100'} flex items-center justify-center`}>
                              <Icon d={SVG.card} className={`w-6 h-6 ${active ? 'text-emerald-600' : 'text-gray-400'}`} />
                            </div>
                            <OverrideBadge isOver={over} color="emerald" onReset={() => handleRemoveOverride(cfgKey)} />
                          </div>
                          <h3 className="font-bold text-gray-900 text-sm mb-0.5">{pm.name_fr}</h3>
                          <p className="text-xs text-gray-400 mb-1" dir="rtl">{pm.name_ar}</p>
                          <p className="text-[11px] font-mono text-gray-400 mb-5 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 inline-block">{pm.code}</p>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-semibold ${active ? 'text-emerald-600' : 'text-gray-400'}`}>{active ? 'Activée' : 'Désactivée'}</span>
                            <Toggle active={active} color="emerald" disabled={saving[cfgKey]} onChange={() => handleToggle(cfgKey, valStr)} />
                          </div>
                          {nodeId && !over && <p className="text-[10px] text-gray-400 mt-2">Valeur globale · Toggle pour créer un override node</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: RÈGLES ────────────────────────────────────────────────── */}
            {tab === 'rules' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                  <Icon d={SVG.gear} className="w-4 h-4 text-violet-500" />
                  <span>Règles globales ou spécifiques à un node. Cliquez sur la valeur pour modifier.</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {RULE_KEYS.map(({ key, type, emoji, label, unit, desc }) => {
                    const val  = getCfgValue(key, type === 'boolean' ? 'false' : '0');
                    const over = isOverridden(key);
                    const inEd = key in editing;
                    return (
                      <div key={key} className={`bg-white rounded-2xl border shadow-sm p-5 ${over ? 'border-violet-200 ring-2 ring-violet-100' : 'border-gray-100'}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{emoji}</span>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{label}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
                            </div>
                          </div>
                          <OverrideBadge isOver={over} color="violet" onReset={() => handleRemoveOverride(key)} />
                        </div>

                        {inEd ? (
                          <div className="flex items-center gap-2 mt-3">
                            {type === 'boolean' ? (
                              <div className="flex gap-2 flex-1">
                                {['true','false'].map(v => (
                                  <button key={v} type="button" onClick={() => setEditing(e => ({ ...e, [key]: v }))}
                                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${editing[key] === v ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 text-gray-600'}`}>
                                    {v === 'true' ? '✓ Activé' : '✕ Désactivé'}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <input type="number" value={editing[key]}
                                onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))}
                                className="flex-1 px-3 py-2 text-sm border border-violet-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
                            )}
                            <button onClick={() => handleRuleSave(key, type)} disabled={saving[key]}
                              className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50">
                              {saving[key] ? '…' : '✓'}
                            </button>
                            <button onClick={() => setEditing(e => { const n = { ...e }; delete n[key]; return n; })}
                              className="px-2 py-2 border border-gray-200 text-gray-500 text-xs rounded-xl hover:bg-gray-50">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between mt-3 cursor-pointer" onClick={() => setEditing(e => ({ ...e, [key]: val }))}>
                            {type === 'boolean' ? (
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${val === 'true' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                {val === 'true' ? '✓ Activé' : '✕ Désactivé'}
                              </span>
                            ) : (
                              <span className="text-2xl font-bold text-gray-900">
                                {val || '—'}<span className="text-sm font-medium text-gray-400 ml-1">{unit}</span>
                              </span>
                            )}
                            <span className="text-xs text-violet-400 hover:text-violet-600 font-semibold">Modifier →</span>
                          </div>
                        )}
                        {nodeId && !over && <p className="text-[10px] text-gray-400 mt-2">Valeur globale · Cliquez modifier pour créer un override</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
