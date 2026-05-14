import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPickupOrder, confirmPickup } from '../../api/pickup.api';

const fmt = (v) => v
  ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

const fmtPrice = (v) => `${Number(v ?? 0).toFixed(2)} MAD`;

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  );
}

function ItemRow({ item }) {
  const article = item.sku?.article;
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{article?.name_fr ?? 'Article'}</p>
        <p className="text-xs text-gray-400 font-mono">{article?.sku_code}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
          item.status?.code === 'out_of_stock' ? 'bg-red-100 text-red-700' :
          item.status?.code === 'substituted' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>{item.status?.name_fr}</span>
      </div>
      <div className="text-right ml-4">
        <p className="text-sm font-bold text-gray-900">{fmtPrice(Number(item.qty) * Number(item.unit_price_sold))}</p>
        <p className="text-xs text-gray-400">{Number(item.qty)} × {fmtPrice(item.unit_price_sold)}</p>
      </div>
    </div>
  );
}

export default function PickupOrderDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [order,      setOrder]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [note,       setNote]       = useState('');
  const [codChecked, setCodChecked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getPickupOrder(id);
      setOrder(r.data?.data);
    } catch { toast.error('Commande introuvable'); navigate('/pickup/orders'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isCOD = order?.payments?.[0]?.payment_method?.code === 'cod';
  const paymentStatus = order?.payments?.[0]?.status?.code;
  const isReady = order?.status?.code === 'ready';
  const isDelivered = order?.status?.code === 'delivered';

  const handleConfirm = async () => {
    if (isCOD && !codChecked) {
      toast.error('Confirmez l\'encaissement du paiement en espèces');
      return;
    }
    setConfirming(true);
    try {
      await confirmPickup(id, {
        payment_collected: true,
        note: note.trim() || 'Commande retirée au magasin',
      });
      toast.success('Retrait confirmé — commande livrée ✓');
      setShowModal(false);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Erreur lors de la confirmation', { duration: 6000 });
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">Chargement…</div>;
  if (!order)  return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Confirmation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏪</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Confirmer le retrait</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              Commande <span className="font-mono font-bold">#{order.id.slice(-8).toUpperCase()}</span>
            </p>
            <p className="text-2xl font-bold text-center text-gray-900 mb-5">{fmtPrice(order.total_ttc)}</p>

            {isCOD && (
              <label className="flex items-start gap-3 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer">
                <input type="checkbox" checked={codChecked} onChange={e => setCodChecked(e.target.checked)}
                  className="mt-0.5 accent-amber-600 w-4 h-4 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">💵 Paiement COD</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    J'ai encaissé <strong>{fmtPrice(order.total_ttc)}</strong> en espèces auprès du client
                  </p>
                </div>
              </label>
            )}

            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Note (optionnel)</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="ex: client présent, pièce vérifiée…"
                className="border rounded-xl px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleConfirm} disabled={confirming || (isCOD && !codChecked)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl">
                {confirming ? 'Confirmation…' : 'Confirmer le retrait'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/pickup/orders')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <div>
          <p className="text-xs text-gray-400 font-mono">#{order.id.slice(-12).toUpperCase()}</p>
          <h1 className="text-xl font-bold text-gray-900">{order.customer?.name}</h1>
        </div>
        <div className="ml-auto">
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            isDelivered ? 'bg-emerald-100 text-emerald-700' :
            isReady     ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {order.status?.name_fr}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Infos commande */}
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-3">Informations</h2>
          <InfoRow label="Client"      value={order.customer?.name} />
          <InfoRow label="Téléphone"   value={`${order.customer?.phone_country ?? ''}${order.customer?.phone_number}`} />
          <InfoRow label="Node"        value={order.node?.name_fr} />
          <InfoRow label="Livraison"   value={order.delivery_type?.name_fr} />
          <InfoRow label="Créé le"     value={fmt(order.created_at)} />
          {order.confirmed_slot && (
            <InfoRow label="Créneau" value={`${order.confirmed_slot.slot_start} – ${order.confirmed_slot.slot_end}`} />
          )}
        </div>

        {/* Paiement */}
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-3">Paiement</h2>
          {order.payments?.length > 0 ? (
            <>
              <InfoRow label="Méthode" value={order.payments[0].payment_method?.name_fr} />
              <InfoRow label="Statut"  value={order.payments[0].status?.name_fr} />
              <InfoRow label="Montant" value={fmtPrice(order.payments[0].amount)} />
            </>
          ) : (
            <p className="text-sm text-gray-400">Aucun paiement enregistré</p>
          )}
          <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-100">
            <span className="font-bold text-gray-700">Total TTC</span>
            <span className="text-xl font-bold text-gray-900">{fmtPrice(order.total_ttc)}</span>
          </div>
        </div>

        {/* Articles */}
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-3">Articles ({order.items?.length ?? 0})</h2>
          {order.items?.length > 0 ? (
            order.items.map(item => <ItemRow key={item.id} item={item} />)
          ) : (
            <p className="text-sm text-gray-400">Aucun article</p>
          )}
        </div>

        {/* Action */}
        {isReady && (
          <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">🏪</span>
              <div>
                <p className="font-bold text-gray-900">Prête pour le retrait</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isCOD
                    ? `Encaissez ${fmtPrice(order.total_ttc)} en espèces avant de confirmer`
                    : 'Vérifiez l\'identité du client et confirmez le retrait'}
                </p>
              </div>
            </div>
            {isCOD && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <span className="text-amber-600 font-bold">💵 COD</span>
                <span className="text-sm text-amber-700 font-semibold">{fmtPrice(order.total_ttc)} à encaisser</span>
              </div>
            )}
            <button
              onClick={() => { setCodChecked(false); setNote(''); setShowModal(true); }}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-base transition-colors">
              ✓ Confirmer le retrait
            </button>
          </div>
        )}

        {isDelivered && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="font-bold text-emerald-800">Retrait confirmé</p>
            <p className="text-sm text-emerald-600 mt-1">Commande clôturée — stock décrémenté</p>
          </div>
        )}
      </div>
    </div>
  );
}
