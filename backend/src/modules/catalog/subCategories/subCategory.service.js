/**
 * Sous-catégories : fonctionnalité retirée (table `sub_categories` supprimée le 18/08/2026,
 * remplacée par les sous-familles SKU). Le module répond proprement sans toucher la base :
 *  - liste  → vide (compatibilité des écrans qui l'appellent encore) ;
 *  - détail / création / modification / suppression / restauration → 410 Gone.
 */
const repo = require('./subCategory.repository');

const GONE_MESSAGE = 'Les sous-catégories ont été supprimées : utilisez les sous-familles SKU.';
const gone = () => ({ statusCode: 410, message: GONE_MESSAGE });

class SubCategoryService {
  async getAll(params = {}) {
    const { data, total } = await repo.findAll(params);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    return { data, pagination: { total, page, limit, pages: 0 }, message: GONE_MESSAGE };
  }

  async getList() {
    return repo.findAll_noPage();
  }

  async getById() { throw gone(); }
  async create() { throw gone(); }
  async update() { throw gone(); }
  async delete() { throw gone(); }
  async restore() { throw gone(); }
}

module.exports = new SubCategoryService();
module.exports.GONE_MESSAGE = GONE_MESSAGE;
