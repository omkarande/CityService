// M4: write source:seed coverage from known dark-store rings.
// Inner disk → available. Edge ring → partial. Does not overwrite probes.
// Usage:  node scripts/infer-hubs.mjs [--dry-run]

import { inferHubs } from './lib/pipeline.mjs';

const dryRun = process.argv.includes('--dry-run');
const result = inferHubs({ dryRun });

console.log(`Hubs used: ${result.hubsUsed.join(', ') || '(none with coordinates)'}`);
console.log(`${dryRun ? 'Would write' : 'Wrote'} ${result.written.length} inferred record(s); skipped ${result.skipped.length} (existing probes).\n`);

for (const row of result.written) {
  console.log(
    `  ${row.platformId} @ ${row.areaId} → ${row.status} (${row.ring}, ${row.distKm}km from ${row.hubName}${row.replaced ? `, replaced ${row.replaced}` : ''})`,
  );
}
