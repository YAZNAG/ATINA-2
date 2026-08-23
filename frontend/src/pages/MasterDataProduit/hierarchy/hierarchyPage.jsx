import { useState } from 'react';
import { GitBranch, Tags } from 'lucide-react';
import CategoriesPage from './CategoriesPage';
import HierarchyCascadePage from './HierarchyCascadePage';

const TABS = [
  { key: 'categories', label: 'Catégories', icon: Tags },
  { key: 'hierarchy', label: 'Hiérarchie', icon: GitBranch },
];

export default function CatalogHierarchy() {
  const [tab, setTab] = useState('categories');

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white px-6 pt-6">
        <h1 className="font-poppins text-2xl font-semibold text-neutral-900">
          Hiérarchie Produit
        </h1>
        <p className="mt-1 pb-4 text-sm text-neutral-500">
          Familles, catégories et sous-catégories du catalogue.
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

      <div className="p-6">
        {tab === 'categories' && <CategoriesPage />}
        {tab === 'hierarchy' && <HierarchyCascadePage />}
      </div>
    </div>
  );
}