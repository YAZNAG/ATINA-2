import { useMemo, useState } from 'react';
import { LayoutGrid, Layers, Package, Info } from 'lucide-react';

// Tri « naturel » : A2 < A10, 02 < 10
const natural = (a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });

const countOf = (loc) => loc._count?.sku_node_locations ?? 0;

/** Couleur d'une cellule selon le nombre de SKU mappés. */
const cellClass = (loc) => {
  if (!loc.is_active) return 'border-gray-200 bg-gray-100 text-gray-400 line-through';
  const n = countOf(loc);
  if (n === 0) return 'border-dashed border-gray-300 bg-white text-gray-500 hover:border-red-300';
  if (n <= 2) return 'border-red-200 bg-red-50 text-red-800 hover:border-red-400';
  if (n <= 5) return 'border-red-300 bg-red-100 text-red-900 hover:border-red-500';
  return 'border-red-500 bg-red-200 text-red-950 hover:border-red-700';
};

/**
 * Plan / Layout d'un node : zones → allées → rayons × niveaux.
 * Chaque cellule = un emplacement (label + nombre de SKU mappés).
 * Grille CSS pure (aucune dépendance), clic sur une cellule → gestion des SKU.
 */
export default function LayoutTab({ node, locations, zones, onOpenLocation }) {
  const [zoneFilter, setZoneFilter] = useState('');

  const plan = useMemo(() => {
    const filtered = locations.filter((l) => {
      if (!zoneFilter) return true;
      if (zoneFilter === 'none') return !l.zone_id;
      return l.zone_id === zoneFilter;
    });

    const zoneMap = new Map();
    for (const loc of filtered) {
      const zKey = loc.zone_id || 'none';
      if (!zoneMap.has(zKey)) {
        zoneMap.set(zKey, {
          key: zKey,
          name: loc.zone?.name_fr || 'Sans zone',
          code: loc.zone?.code || '',
          aisles: new Map(),
        });
      }
      const zone = zoneMap.get(zKey);
      if (!zone.aisles.has(loc.aisle)) zone.aisles.set(loc.aisle, []);
      zone.aisles.get(loc.aisle).push(loc);
    }

    return [...zoneMap.values()]
      .sort((a, b) => (a.key === 'none') - (b.key === 'none') || natural(a.name, b.name))
      .map((zone) => {
        const aisles = [...zone.aisles.entries()]
          .sort(([a], [b]) => natural(a, b))
          .map(([aisle, locs]) => {
            const shelves = [...new Set(locs.map((l) => l.shelf))].sort(natural);
            // Niveaux du plus haut (sort_order élevé) au plus bas, pour lire le rayon comme en vrai.
            const levelMap = new Map();
            locs.forEach((l) => {
              if (!levelMap.has(l.level_id)) {
                levelMap.set(l.level_id, {
                  id: l.level_id,
                  name: l.level?.name_fr || l.level?.code || '—',
                  code: l.level?.code || '',
                  sort: l.level?.sort_order ?? 0,
                });
              }
            });
            const levels = [...levelMap.values()].sort((a, b) => b.sort - a.sort || natural(a.code, b.code));
            const cell = new Map(locs.map((l) => [`${l.shelf}|${l.level_id}`, l]));
            return {
              aisle,
              shelves,
              levels,
              cell,
              skuCount: locs.reduce((s, l) => s + countOf(l), 0),
              count: locs.length,
            };
          });
        return {
          ...zone,
          aisles,
          locCount: aisles.reduce((s, a) => s + a.count, 0),
          skuCount: aisles.reduce((s, a) => s + a.skuCount, 0),
        };
      });
  }, [locations, zoneFilter]);

  const totalSku = plan.reduce((s, z) => s + z.skuCount, 0);
  const totalLoc = plan.reduce((s, z) => s + z.locCount, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-gray-100 bg-white px-6 py-3">
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Toutes les zones</option>
          <option value="none">Sans zone</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name_fr}</option>)}
        </select>
        <span className="text-xs text-gray-500">
          {totalLoc} emplacement{totalLoc > 1 ? 's' : ''} · {totalSku} SKU mappé{totalSku > 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-dashed border-gray-300 bg-white" /> Vide</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-red-200 bg-red-50" /> 1–2 SKU</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-red-300 bg-red-100" /> 3–5 SKU</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-red-500 bg-red-200" /> 6+ SKU</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-gray-200 bg-gray-100" /> Inactif</span>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {plan.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <LayoutGrid size={36} className="text-red-200" />
            <p className="font-semibold text-gray-600">
              {zoneFilter ? 'Aucun emplacement dans cette zone.' : `Aucun emplacement pour ${node.name_fr}.`}
            </p>
            <p className="text-sm text-gray-400">Créez des emplacements dans l'onglet « Emplacements par node » pour construire le plan.</p>
          </div>
        ) : plan.map((zone) => (
          <section key={zone.key} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-red-500" />
                <h3 className="text-sm font-bold text-gray-800">{zone.name}</h3>
                {zone.code && <span className="font-mono text-xs text-gray-400">{zone.code}</span>}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{zone.aisles.length} allée{zone.aisles.length > 1 ? 's' : ''}</span>
                <span>{zone.locCount} emplacement{zone.locCount > 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1"><Package size={12} /> {zone.skuCount} SKU</span>
              </div>
            </header>

            <div className="flex gap-5 overflow-x-auto p-5">
              {zone.aisles.map((a) => (
                <div key={a.aisle} className="flex-shrink-0 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-700">Allée {a.aisle}</span>
                    <span className="text-[11px] text-gray-400">{a.skuCount} SKU</span>
                  </div>
                  <div
                    className="grid gap-1.5"
                    style={{ gridTemplateColumns: `auto repeat(${a.shelves.length}, minmax(76px, 1fr))` }}
                  >
                    {/* En-tête : rayons */}
                    <span />
                    {a.shelves.map((sh) => (
                      <span key={`h-${sh}`} className="text-center text-[10px] font-semibold uppercase text-gray-400">Rayon {sh}</span>
                    ))}
                    {/* Lignes : niveaux (haut → bas) */}
                    {a.levels.map((lv) => (
                      <div key={lv.id} className="contents">
                        <span className="flex items-center pr-1 text-[10px] font-semibold text-gray-500" title={lv.name}>
                          {lv.name}
                        </span>
                        {a.shelves.map((sh) => {
                          const loc = a.cell.get(`${sh}|${lv.id}`);
                          if (!loc) {
                            return <span key={`${sh}-${lv.id}`} className="h-14 rounded-lg border border-transparent bg-gray-100/60" />;
                          }
                          const n = countOf(loc);
                          return (
                            <button
                              key={loc.id}
                              type="button"
                              onClick={() => onOpenLocation?.(loc)}
                              title={`${loc.label} — ${n} SKU mappé(s)${loc.is_active ? '' : ' — inactif'}`}
                              className={`flex h-14 flex-col items-center justify-center rounded-lg border px-1 text-center transition ${cellClass(loc)}`}
                            >
                              <span className="font-mono text-[11px] font-bold leading-tight">{loc.label}</span>
                              <span className="mt-0.5 text-[10px]">{n} SKU</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {plan.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <Info size={13} /> Cliquez sur un emplacement pour gérer ses SKU. Les niveaux sont affichés du plus haut au plus bas.
          </p>
        )}
      </div>
    </div>
  );
}
