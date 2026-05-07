/**
 * seed-all.js
 * Runs all seeders in dependency order:
 *   1. seed-moroccan-data.js  → regions, provinces, cities, brands, articles
 *   2. seed-warehouse-params.js → nodeTypes, zones, levels, all P0 lookup tables, nodes
 *
 * Run: node scripts/seed-all.js
 */

const { execSync } = require('child_process');
const path = require('path');

const scripts = [
  'seed-moroccan-data.js',
  'seed-warehouse-params.js',
];

console.log('\n🚀  Lancement de tous les seeders…\n');
console.log('═'.repeat(60));

for (const script of scripts) {
  const fullPath = path.join(__dirname, script);
  console.log(`\n▶  ${script}`);
  console.log('─'.repeat(60));
  try {
    execSync(`node "${fullPath}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`\n❌  Erreur dans ${script}`);
    process.exit(1);
  }
}

console.log('\n' + '═'.repeat(60));
console.log('✅  Tous les seeders ont été exécutés avec succès!\n');
