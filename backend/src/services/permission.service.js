const permissionRepository = require('../repositories/permission.repository');

/**
 * Catalogue des droits (US-121 → US-125). Une permission = une RESSOURCE × une
 * ACTION (read / write / delete / export). Le catalogue est en LECTURE SEULE :
 * il est seedé puis étendu par migration quand un écran arrive ; le superadmin
 * coche, il ne crée jamais une permission depuis l'écran.
 *
 * Plusieurs codes historiques peuvent tomber sur la même case de la matrice
 * (orders.create et orders.update sont tous deux « orders × write ») : la case
 * regroupe alors ces codes et cocher la case les accorde tous.
 */

const ACTIONS = ['read', 'write', 'delete', 'export'];

const labelOfResource = (perms) => {
  // Libellé lisible : on prend le nom FR le plus court du groupe, sans le verbe.
  const names = perms.map((p) => p.name_fr || p.name).filter(Boolean);
  const base = names.sort((a, b) => a.length - b.length)[0] || perms[0].resource;
  return String(base).replace(/^(Voir|Lister|Créer|Modifier|Supprimer|Gérer|Exporter)\s+/i, '');
};

class PermissionService {
  /** Catalogue à plat, groupé par module (compatibilité écran historique). */
  async getAll() {
    const permissions = await permissionRepository.findAll();
    return permissions.reduce((acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    }, {});
  }

  /**
   * Matrice du classeur : modules → ressources (lignes) × actions (colonnes).
   * Chaque cellule porte les identifiants de permission à cocher.
   */
  async getMatrix() {
    const permissions = await permissionRepository.findAll();
    const byModule = new Map();

    for (const p of permissions) {
      const moduleKey = p.module || 'divers';
      if (!byModule.has(moduleKey)) byModule.set(moduleKey, new Map());
      const resources = byModule.get(moduleKey);
      if (!resources.has(p.resource)) resources.set(p.resource, []);
      resources.get(p.resource).push(p);
    }

    const modules = [...byModule.entries()]
      .map(([moduleKey, resources]) => ({
        module: moduleKey,
        resources: [...resources.entries()]
          .map(([resource, perms]) => ({
            resource,
            label: labelOfResource(perms),
            cells: Object.fromEntries(ACTIONS.map((action) => {
              const cell = perms.filter((p) => p.action === action);
              return [action, cell.length
                ? {
                  permission_ids: cell.map((p) => p.id),
                  codes: cell.map((p) => p.code),
                  label: cell.map((p) => p.name_fr || p.name).join(' · '),
                }
                : null];
            })),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
      }))
      .sort((a, b) => a.module.localeCompare(b.module, 'fr'));

    return { actions: ACTIONS, modules, total: permissions.length };
  }
}

module.exports = new PermissionService();
module.exports.ACTIONS = ACTIONS;
