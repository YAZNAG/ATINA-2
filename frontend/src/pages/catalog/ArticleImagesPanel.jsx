import { useState, useEffect } from 'react';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function ArticleImagesPanel({ articleId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { hasPermission } = useAuth();
  const canManage = hasPermission('article_images.manage');

  const load = async () => {
    setLoading(true);
    try {
      const res = await catalog.getArticleImages(articleId);
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
    if (!files?.length || !canManage) return;
    const fd = new FormData();
    for (let i = 0; i < files.length; i += 1) fd.append('images', files[i]);
    setUploading(true);
    try {
      await catalog.addArticleImages(articleId, fd);
      toast.success('Images ajoutées');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const setMain = async (imageId) => {
    try {
      await catalog.setArticleMainImage(articleId, imageId);
      toast.success('Image principale mise à jour');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const updateSort = async (imageId, sort_order) => {
    try {
      await catalog.setArticleImageSort(articleId, imageId, Number(sort_order));
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (imageId) => {
    if (!window.confirm('Supprimer cette image ?')) return;
    try {
      await catalog.deleteArticleImage(articleId, imageId);
      toast.success('Image supprimée');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-800">Images produit</h2>
          <p className="text-xs text-gray-500">Ajout, image principale, ordre, suppression logique côté API.</p>
        </div>
        {canManage && (
          <label className="btn-secondary text-sm cursor-pointer inline-block">
            {uploading ? 'Envoi…' : '+ Ajouter des images'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleFiles} disabled={uploading} />
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : images.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune image. Les images ne sont pas stockées comme simple champ texte sur l’article.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-th">Aperçu</th>
                <th className="table-th">Principal</th>
                <th className="table-th">Ordre</th>
                <th className="table-th">Chemin</th>
                {canManage && <th className="table-th">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {images.map((img) => (
                <tr key={img.id}>
                  <td className="table-td">
                    <img
                      src={img.image_path}
                      alt=""
                      className="h-14 w-14 object-cover rounded border border-gray-100"
                    />
                  </td>
                  <td className="table-td">
                    {img.is_main ? (
                      <span className="badge-active">Oui</span>
                    ) : canManage ? (
                      <button type="button" className="text-blue-600 text-xs font-medium" onClick={() => setMain(img.id)}>
                        Définir principal
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="table-td">
                    {canManage ? (
                      <input
                        type="number"
                        min={0}
                        className="form-input py-1 w-20 text-xs"
                        defaultValue={img.sort_order}
                        onBlur={(e) => updateSort(img.id, e.target.value)}
                      />
                    ) : (
                      img.sort_order
                    )}
                  </td>
                  <td className="table-td font-mono text-xs text-gray-500 truncate max-w-[180px]" title={img.image_path}>
                    {img.image_path}
                  </td>
                  {canManage && (
                    <td className="table-td">
                      <button type="button" className="text-red-500 text-xs font-medium" onClick={() => remove(img.id)}>
                        Supprimer
                      </button>
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
