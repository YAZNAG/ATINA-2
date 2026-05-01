import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const cards = [
  {
    to: '/geo/regions',
    title: 'Régions',
    description: 'Niveau supérieur : codes et libellés FR/AR.',
    permission: 'regions.view',
  },
  {
    to: '/geo/provinces',
    title: 'Provinces',
    description: 'Rattachées à une région.',
    permission: 'provinces.view',
  },
  {
    to: '/geo/cities',
    title: 'Villes',
    description: 'Rattachées à une province, code postal optionnel.',
    permission: 'cities.view',
  },
];

export default function GeoDashboard() {
  const { hasPermission } = useAuth();
  const visible = cards.filter((c) => hasPermission(c.permission));

  if (!visible.length) {
    return (
      <div className="page-shell">
        <p className="text-center py-12 text-slate-500 text-sm">Vous n’avez aucune permission géographie.</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Géographie</h1>
          <p className="page-subtitle">
            Accès rapide aux écrans régions, provinces et villes — chaque niveau a sa propre page.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="card hover:border-blue-300 transition-colors border-slate-200 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-800">{c.title}</h2>
            <p className="text-sm text-slate-500 mt-2">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
