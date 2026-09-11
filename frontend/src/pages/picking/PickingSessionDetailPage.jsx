import PickingSessionsPage from './PickingSessionsPage';

/**
 * Route /picking/sessions/:id — même page à onglets que /picking/sessions,
 * ouverte sur l'onglet « Détail session & items » (l'id est lu via useParams).
 */
export default function PickingSessionDetailPage() {
  return <PickingSessionsPage />;
}
