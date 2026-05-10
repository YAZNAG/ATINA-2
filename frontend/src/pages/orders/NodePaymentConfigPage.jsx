import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getOrderConfigs, saveOrderConfig, deleteOrderConfig } from '../../api/orders.api';
import { getNodes } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  node:    'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  globe:   'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
  truck:   'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  wallet:  'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  arrows:  'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  trash:   'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const METHODS = [
  {
    key: 'payment_method_cod', code: 'cod', icon: SVG.truck,
    label: 'COD — Paiement à la livraison',
    label_ar: 'الدفع عند الاستلام',
    desc: 'Client paye en espèces à la réception',
    color: 'emerald', default: 'true',
  },
  {
    key: 'payment_method_wallet', code: 'wallet', icon: SVG.wallet,
    label: 'Wallet — Portefeuille électronique',
    label_ar: 'المحفظة الإلكترونية',
    desc: 'Débit depuis le solde wallet client',
    color: 'violet', default: 'false',
  },
  {
    key: 'payment_method_mixed', code: 'mixed', icon: SVG.arrows,
    label: 'Mixte — Wallet + COD',
    label_ar: 'دفع مختلط',
    desc: 'Combinaison wallet et paiement espèces',
    color: 'amber', default: 'false',
  },
];

const COLOR = {
  emerald: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', toggle: 'bg-emerald-500', iconbg: 'bg-emerald-100', iconc: 'text-emerald-600' },
  violet:  { ring: 'ring-violet-200',  bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  toggle: 'bg-violet-500',  iconbg: 'bg-violet-100',  iconc: 'text-violet-600'  },
  amber:   { ring: 'ring-amber-200',   bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   toggle: 'bg-amber-500',   iconbg: 'bg-amber-100',   iconc: 'text-amber-600'   },
};

export default function NodePaymentConfigPage() {
  const [nodes, setNodes]     = useState([]);
  const [nodeId, setNodeId]   = useState('');
  const [globalCfg, setGlobalCfg] = useState({});
  const [nodeCfg, setNodeCfg] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState({});

  useEffect(() => {
    getNodes({ all: true, limit: 500 }).then(r => setNodes(r.data?.data ?? r.data ?? [])).catch(() => {});
  }, []);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const keys = METHODS.map(m => m.key).join(',');
      const toMap = (arr) => Object.fromEntries((arr ?? []).map(c => [c.config_key, c]));
      const globalRes = await getOrderConfigs({ node_id: 'null', keys });
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

  const getValue = (key, def) => {
    const nc = nodeCfg[key];
    const gc = globalCfg[key];
    return (nc?.config_value ?? gc?.config_value ?? def) === 'true';
  };

  const isOverridden = (key) => !!nodeCfg[key];

  const handleToggle = async (method) => {
    const { key, default: def, code } = method;
    const current = getValue(key, def);
    // COD protection: can't disable global COD if it's the only active method
    if (code === 'cod' && current && !nodeId) {
      const anyOtherActive = METHODS.filter(m => m.code !== 'cod').some(m => getValue(m.key, m.default));
      if (!anyOtherActive) { toast.error('Impossible — aucune autre méthode active'); return; }
    }
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await saveOrderConfig({ node_id: nodeId || null, config_key: key, config_value: String(!current), value_type_code: 'boolean' });
      toast.success(!current ? 'Méthode activée' : 'Méthode désactivée');
      await loadConfigs();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(s => ({ ...s, [key]: false })); }
  };

  const handleRemoveOverride = async (key) => {
    const cfg = nodeCfg[key];
    if (!cfg) return;
    try { await deleteOrderConfig(cfg.id); toast.success('Override supprimé'); await loadConfigs(); }
    catch (err) { toast.error(getErrorMessage(err)); }
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
                <span className="text-emerald-600 font-medium">Méthodes paiement</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Méthodes paiement par node</h1>
              <p className="text-sm text-gray-400 mt-0.5">Activer / désactiver COD, Wallet, Mixte — globalement ou par node</p>
            </div>
          </div>

          {/* Scope selector */}
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Scope :</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setNodeId('')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!nodeId ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-600 hover:border-emerald-300'}`}>
                <Icon d={SVG.globe} className="w-3.5 h-3.5" />Global
              </button>
              {nodes.map(n => (
                <button key={n.id} onClick={() => setNodeId(n.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${nodeId === n.id ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-600 hover:border-emerald-300'}`}>
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
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : (
          <>
            {nodeId && (
              <div className="mb-5 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                <Icon d={SVG.node} className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-emerald-800">{selectedNode?.name_fr}</span>
                <span className="text-emerald-500 text-xs">— Les toggles créent/écrasent la config de ce node</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {METHODS.map((method) => {
                const { key, icon, label, label_ar, desc, color, default: def, code } = method;
                const active    = getValue(key, def);
                const isOver    = nodeId && isOverridden(key);
                const isGlobal  = nodeId && !isOverridden(key);
                const clr       = COLOR[color];
                const isSaving  = saving[key];

                return (
                  <div key={key} className={`bg-white rounded-2xl border shadow-sm p-6 transition-all ${active ? `${clr.border} ring-2 ${clr.ring}` : 'border-gray-200'} ${isOver ? 'ring-2' : ''}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl ${active ? clr.iconbg : 'bg-gray-100'} flex items-center justify-center transition-colors`}>
                        <Icon d={icon} className={`w-6 h-6 ${active ? clr.iconc : 'text-gray-400'}`} />
                      </div>
                      {nodeId && (
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isOver ? `${clr.bg} ${clr.text} ${clr.border}` : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                            {isOver ? 'Override' : 'Global'}
                          </span>
                          {isOver && (
                            <button onClick={() => handleRemoveOverride(key)} className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5">
                              <Icon d={SVG.trash} className="w-3 h-3" />reset
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <h3 className="font-bold text-gray-900 text-sm mb-0.5">{label}</h3>
                    <p className="text-xs text-gray-400 mb-1" dir="rtl">{label_ar}</p>
                    <p className="text-xs text-gray-500 mb-5">{desc}</p>

                    {/* Code ref */}
                    <p className="text-[11px] font-mono text-gray-400 mb-4 bg-gray-50 px-2 py-1 rounded-lg inline-block border border-gray-100">{code}</p>

                    {/* Toggle */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${active ? clr.text : 'text-gray-400'}`}>
                        {active ? 'Activé' : 'Désactivé'}
                      </span>
                      <button type="button" disabled={isSaving}
                        onClick={() => handleToggle(method)}
                        className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${active ? clr.toggle : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-6' : ''}`} />
                      </button>
                    </div>

                    {isGlobal && (
                      <p className="text-[10px] text-gray-400 mt-3">Valeur globale · Le toggle crée un override pour ce node</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Phase 1 info */}
            <div className="mt-6 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-amber-500 text-lg">ℹ</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Phase 1 — COD actif par défaut</p>
                <p className="text-xs text-amber-600 mt-0.5">Wallet et Mixte seront activables après intégration gateway de paiement.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
