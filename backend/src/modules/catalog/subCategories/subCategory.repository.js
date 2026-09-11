/**
 * Module mort : la table `sub_categories` a été supprimée (migration du 18 août 2026,
 * remplacée par les sous-familles SKU — sku_subfamilies). Plus aucun accès base ici :
 * les lectures renvoient du vide, les écritures sont refusées (410) par le service.
 */
const findAll = async () => ({ data: [], total: 0 });
const findAll_noPage = async () => [];
const findById = async () => null;
const findByIdIncludingDeleted = async () => null;
const findByCode = async () => null;
const countArticles = async () => 0;

module.exports = { findAll, findAll_noPage, findById, findByIdIncludingDeleted, findByCode, countArticles };
