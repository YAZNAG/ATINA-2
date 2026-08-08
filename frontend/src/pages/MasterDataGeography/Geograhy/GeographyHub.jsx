import { useState } from 'react';
import { LayoutGrid, Map, MapPin, Building2 } from 'lucide-react';
import GeographyPage from './Geographypage';
import RegionsPage from './RegionsPage';
import ProvincesPage from './ProvincesPage';
import CitiesPage from './CitiesPage';

const TABS = [
  { key: 'cascade',   label: 'Vue cascade', icon: LayoutGrid, Component: GeographyPage },
  { key: 'regions',   label: 'Régions',      icon: Map,        Component: RegionsPage },
  { key: 'provinces', label: 'Provinces',    icon: MapPin,     Component: ProvincesPage },
  { key: 'cities',    label: 'Villes',       icon: Building2,  Component: CitiesPage },
];

export default function GeographyHub() {
  const [tab, setTab] = useState('cascade');
  const Active = TABS.find((t) => t.key === tab).Component;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white px-6 pt-6">
        <h1 className="font-poppins text-2xl font-semibold text-neutral-900">
          Région, Province & Ville
        </h1>
        <p className="mt-1 pb-4 text-sm text-neutral-500">
          Référentiel géographique : vue en cascade ou listes détaillées.
        </p>
        <div className="flex gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === key
                  ? 'border-[#E10600] text-[#E10600]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <Active embedded />
    </div>
  );
}