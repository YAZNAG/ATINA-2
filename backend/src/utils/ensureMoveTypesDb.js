/**
 * Alignement `move_types` avec schema.prisma (MoveType).
 * L’init stock ne créait pas la colonne `color` (couleur UI).
 */
let moveTypesPrismaColumnsEnsured = false;

async function ensureMoveTypesPrismaColumns(db) {
  if (moveTypesPrismaColumnsEnsured) return;
  await db.$executeRawUnsafe(
    'ALTER TABLE "move_types" ADD COLUMN IF NOT EXISTS "color" VARCHAR(20)',
  );
  moveTypesPrismaColumnsEnsured = true;
}

module.exports = { ensureMoveTypesPrismaColumns };
