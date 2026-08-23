// Record a live M1 check into checkpoints, coverage.seed, and hubs.
// Usage:
//   node scripts/record-check.mjs --pincode 411018 --platform zepto --status available --eta 8 --note "MIDC store" --store MIDC --area pimpri-chinchwad

import { recordCheck } from './lib/pipeline.mjs';

const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

try {
  const etaRaw = flag('eta');
  const result = recordCheck({
    pincode: flag('pincode'),
    platformId: flag('platform'),
    status: flag('status'),
    etaMinutes: etaRaw != null ? Number(etaRaw) : undefined,
    note: flag('note'),
    storeName: flag('store'),
    storeLat: flag('store-lat') != null ? Number(flag('store-lat')) : undefined,
    storeLng: flag('store-lng') != null ? Number(flag('store-lng')) : undefined,
    areaId: flag('area'),
  });
  console.log(`Recorded ${result.checkpoint.platformId} @ ${result.checkpoint.pincode} → ${result.checkpoint.status}`);
  console.log(`  coverage areaId: ${result.areaId}`);
  if (result.hub) console.log(`  hub: ${result.hub.id} (${result.hub.lat ?? 'no coords'}, ${result.hub.lng ?? 'no coords'})`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
