import { useState, useEffect, useMemo } from 'react';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

/**
 * Galerie article : plusieurs images par article, une image principale, ordre d’affichage (sku_images).
 */
export default function ArticleSkuImagesPanel({ articleId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { hasPermission } = useAuth();
  const canView = hasPermission('articles.view');
  // Compat : droits « images SKU » ou ancien droit unique « images article »
  const canCreate =
    hasPermission('sku_images.create') || hasPermission('article_images.manage');
  const canUpdate =
    hasPermission('sku_images.update') || hasPermission('article_images.manage');
  const canDelete =
    hasPermission('sku_images.delete') || hasPermission('article_images.manage');

  const sortedImages = useMemo(
    () =>
      [...images].sort((a, b) => {
        const ao = Number(a.sort_order) || 0;
        const bo = Number(b.sort_order) || 0;
        if (ao !== bo) return ao - bo;
        return String(a.id).localeCompare(String(b.id));
      }),
    [images],
  );

  const load = async () => {
    if (!canView) {
      setImages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await catalog.getArticleSkuImages(articleId);
      setImages(res.data.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [articleId]);

  const handleFiles = async (e) => {
    const files = e.target.files;
    if (!files?.length || !canCreate) return;
    const fd = new FormData();
    for (let i = 0; i < files.length; i += 1) fd.append('images', files[i]);
    setUploading(true);
    try {
      await catalog.addArticleSkuImages(articleId, fd);
      toast.success('Images ajoutées');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const setPrimary = async (imageId) => {
    if (!canUpdate) return;
    try {
      await catalog.setArticleSkuPrimaryImage(articleId, imageId);
      toast.success('Image principale enregistrée (listings & fiche produit)');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const updateSort = async (imageId, sort_order) => {
    if (!canUpdate) return;
    try {
      await catalog.setArticleSkuImageSort(articleId, imageId, Number(sort_order));
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const swapWithNeighbor = async (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= sortedImages.length || !canUpdate) return;
    const a = sortedImages[index];
    const b = sortedImages[next];
    const oa = Number(a.sort_order) || 0;
    const ob = Number(b.sort_order) || 0;
    try {
      await catalog.setArticleSkuImageSort(articleId, a.id, ob);
      await catalog.setArticleSkuImageSort(articleId, b.id, oa);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (imageId) => {
    if (!canDelete) return;
    if (!window.confirm('Supprimer cette image ?')) return;
    try {
      await catalog.deleteArticleSkuImage(articleId, imageId);
      toast.success('Image supprimée');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (!canView) {
    return null;
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-800">Galerie images</h2>
          <ul className="text-xs text-gray-600 mt-1 space-y-0.5 list-disc list-inside">
            <li>Ajoutez <strong>autant d’images</strong> que nécessaire (bouton multi-fichiers).</li>
            <li>Une seule image <strong>principale</strong> à la fois (listings, vignette catalogue).</li>
            <li><strong>Ordre d’affichage</strong> : le plus petit numéro apparaît en premier ; boutons ↑ ↓ ou champ numérique.</li>
          </ul>
        </div>
        {canCreate && (
          <label className="btn-secondary text-sm cursor-pointer inline-block shrink-0">
            {uploading ? 'Envoi…' : '+ Ajouter des images'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFiles}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : images.length === 0 ? (
        <p className="text-sm text-gray-400">Encore aucune image pour cet article.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-th w-10">#</th>
                <th className="table-th">Aperçu</th>
                <th className="table-th">Principale</th>
                <th className="table-th">Ordre</th>
                <th className="table-th hidden lg:table-cell">Fichier</th>
                {(canUpdate || canDelete) && <th className="table-th">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedImages.map((img, idx) => (
                <tr key={img.id}>
                  <td className="table-td text-gray-400 text-xs">{idx + 1}</td>
                  <td className="table-td">
                    <img
                      src={img.url}
                      alt={img.alt_fr || ''}
                      className="h-16 w-16 object-cover rounded border border-gray-100"
                    />
                  </td>
                  <td className="table-td">
                    {img.is_primary ? (
                      <span className="badge-active">Principale</span>
                    ) : canUpdate ? (
                      <button type="button" className="text-blue-600 text-xs font-medium" onClick={() => setPrimary(img.id)}>
                        Définir comme principale
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="table-td">
                    <div className="flex flex-wrap items-center gap-1">
                      {canUpdate && (
                        <>
                          <button
                            type="button"
                            className="px-1.5 py-0.5 text-xs border rounded border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                            disabled={idx === 0}
                            onClick={() => swapWithNeighbor(idx, -1)}
                            title="Monter"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="px-1.5 py-0.5 text-xs border rounded border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                            disabled={idx >= sortedImages.length - 1}
                            onClick={() => swapWithNeighbor(idx, 1)}
                            title="Descendre"
                          >
                            ↓
                          </button>
                        </>
                      )}
                      {canUpdate ? (
                        <input
                          type="number"
                          min={0}
                          className="form-input py-1 w-16 text-xs"
                          key={`${img.id}-${img.sort_order}`}
                          defaultValue={img.sort_order}
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v !== '' && Number(v) !== Number(img.sort_order)) {
                              updateSort(img.id, v);
                            }
                          }}
                        />
                      ) : (
                        <span>{img.sort_order}</span>
                      )}
                    </div>
                  </td>
                  <td className="table-td font-mono text-xs text-gray-500 truncate max-w-[200px] hidden lg:table-cell" title={img.url}>
                    {img.url}
                  </td>
                  {(canUpdate || canDelete) && (
                    <td className="table-td">
                      {canDelete && (
                        <button type="button" className="text-red-500 text-xs font-medium" onClick={() => remove(img.id)}>
                          Supprimer
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
