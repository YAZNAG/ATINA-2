/**
 * Alignement table `node_types` avec schema.prisma (NodeType).
 * Les BDD créées avec l’init seule n’avaient pas description / icon / color_badge / is_active.
 */
let nodeTypesPrismaColumnsEnsured = false;

async function ensureNodeTypesPrismaColumns(db) {
  if (nodeTypesPrismaColumnsEnsured) return;
  const alters = [
    'ALTER TABLE "node_types" ADD COLUMN IF NOT EXISTS "description" TEXT',
    'ALTER TABLE "node_types" ADD COLUMN IF NOT EXISTS "icon" TEXT',
    'ALTER TABLE "node_types" ADD COLUMN IF NOT EXISTS "color_badge" TEXT',
    'ALTER TABLE "node_types" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true',
  ];
  for (const sql of alters) {
    await db.$executeRawUnsafe(sql);
  }
  nodeTypesPrismaColumnsEnsured = true;
}

module.exports = { ensureNodeTypesPrismaColumns };
