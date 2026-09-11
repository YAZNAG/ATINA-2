import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TourDetailPanel from './TourDetailPanel';

// Route /delivery/tours/:id — « Détail tournée & arrêts » en pleine page.
export default function TourDetailPage() {
  const { id } = useParams();
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/delivery/tours" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600"><ChevronLeft size={16} /> Tournées & Livreurs</Link>
      </div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Détail tournée & arrêts</h1>
      <TourDetailPanel tourId={id} />
    </div>
  );
}
