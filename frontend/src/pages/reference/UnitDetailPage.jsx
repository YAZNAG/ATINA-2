import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Lock, Package, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getUnit,
  getPackagingTypes,
} from '../../api/catalog.api';

function UnitStatusBadge({ status, deleted_at }) {
  if (deleted_at) {
    return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">Supprimé</span>;
  }
  if (status === 'active') {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Actif</span>;
  }
  return <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">Inactif</span>;
}

function PtStatusBadge({ status, deleted_at }) {
  if (deleted_at) {
    return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">Supprimé</span>;
  }
  if (status === 'active') {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Actif</span>;
  }
  return <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">Inactif</span>;
}

function Field({ label, error, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-neutral-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#E10600]">{error}</span>}
    </label>
  );
}

function inputClass(error) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
    error ? 'border-[#E10600] focus:ring-[#E10600]/15' : 'border-neutral-200 focus:border-[#E10600] focus:ring-[#E10600]/15'
  }`;
}

export default function UnitDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canViewPT = hasPermission('packaging_types.view');

  // ——— Unité ———
  const [unit, setUnit] = useState(null);
  const [loadingUnit, setLoadingUnit] = useState(true);

  // ——— Types de conditionnement ———
  const [packagingTypes, setPackagingTypes] = useState([]);
  const [loadingPT, setLoadingPT] = useState(true);

  // ——— Toast ———
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ——— Chargement unité ———
  const fetchUnit = useCallback(async () => {
    setLoadingUnit(true);
    try {
      const { data } = await getUnit(id);
      setUnit(data.data);
    } catch (err) {
      showToast('error', err?.response?.data?.message || "Erreur lors du chargement de l'unité");
    } finally {
      setLoadingUnit(false);
    }
  }, [id]);

  // ——— Chargement packaging types de cette unité ———
  const fetchPackagingTypes = useCallback(async () => {
    if (!canViewPT) return;
    setLoadingPT(true);
    try {
      const { data } = await getPackagingTypes({ unit_id: id });
      setPackagingTypes(data.data || []);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des types de conditionnement');
    } finally {
      setLoadingPT(false);
    }
  }, [id, canViewPT]);

  useEffect(() => {
    fetchUnit();
  }, [fetchUnit]);

  useEffect(() => {
    fetchPackagingTypes();
  }, [fetchPackagingTypes]);

  if (loadingUnit) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-neutral-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <Lock size={28} />
        <p className="text-sm">Unité introuvable.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-[#E10600] hover:underline">
          Retour
        </button>
      </div>
    );
  }

  const isDeleted = Boolean(unit.deleted_at);

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-[#E10600]'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* En-tête */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft size={16} />
        Retour aux unités
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">{unit.name_fr}</h1>
          <p className="mt-1 text-sm text-neutral-500">Détail de l'unité de mesure.</p>
        </div>
      </div>

      {isDeleted && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle size={16} />
          Cette unité a été supprimée. Elle n'est plus disponible pour être utilisée.
        </div>
      )}

      {/* Informations */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-poppins text-base font-semibold text-neutral-900">Général</h2>
            <UnitStatusBadge status={unit.status} deleted_at={unit.deleted_at} />
          </div>
          <InfoItem label="Nom (FR)" value={unit.name_fr} />
          <InfoItem label="Nom (AR)" value={unit.name_ar} dir="rtl" />
          <InfoItem label="Code" value={unit.code} mono />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 font-poppins text-base font-semibold text-neutral-900">Informations complémentaires</h2>
          <InfoItem label="Abréviation (FR)" value={unit.short_name_fr || '—'} />
          <InfoItem label="Abréviation (AR)" value={unit.short_name_ar || '—'} dir="rtl" />
          <InfoItem label="Ordre" value={unit.sort_order ?? '—'} />
          <InfoItem label="Types de conditionnement" value={packagingTypes.length} />
        </div>
      </div>

      {/* Affichage des types de conditionnement — consultation seule */}
      {canViewPT && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-neutral-400" />
              <h2 className="font-poppins text-base font-semibold text-neutral-900">Types de conditionnement</h2>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                {packagingTypes.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nom (FR)</th>
                <th className="px-4 py-3 font-medium">Nom (AR)</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Quantité</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loadingPT ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                    <Loader2 size={20} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : packagingTypes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                    Aucun type de conditionnement pour cette unité.
                  </td>
                </tr>
              ) : (
                packagingTypes.map((pt) => {
                  const isDeleted = Boolean(pt.deleted_at);
                  return (
                    <tr key={pt.id} className={`transition hover:bg-neutral-50 ${isDeleted ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-medium text-neutral-800">{pt.name_fr}</td>
                      <td className="px-4 py-3 text-neutral-600" dir="rtl">{pt.name_ar}</td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500">{pt.code}</td>
                      <td className="px-4 py-3 text-neutral-600">
                        {pt.quantity} {unit.short_name_fr || unit.code}
                      </td>
                      <td className="px-4 py-3">
                        <PtStatusBadge status={pt.status} deleted_at={pt.deleted_at} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

function InfoItem({ label, value, dir, mono }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-1 text-sm text-neutral-800 ${mono ? 'font-mono' : ''}`} dir={dir}>{value}</p>
    </div>
  );
}

