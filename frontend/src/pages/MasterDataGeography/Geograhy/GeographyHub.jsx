import GeographyPage from './Geographypage';

export default function GeographyHub() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white px-6 pt-6">
        <h1 className="font-poppins text-2xl font-semibold text-neutral-900">
          Région & Ville
        </h1>
        <p className="mt-1 pb-4 text-sm text-neutral-500">
          Référentiel géographique.
        </p>
      </div>

      <GeographyPage embedded />
    </div>
  );
}