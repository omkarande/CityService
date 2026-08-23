// M5 next-point picker. Hub-edge biased for Zepto/Blinkit/Instamart.
// Usage:  node scripts/pick-next-check.mjs [count]

import { loadUniverse, suggest, TIER_1_PLATFORMS } from './lib/pipeline.mjs';

const count = Number(process.argv[2]) || 10;
const universe = loadUniverse();
console.log(
  `Universe: ${universe.length} PMC/PCMC pincodes. Tier-1: ${TIER_1_PLATFORMS.join(', ')}\n`,
);

const picks = suggest(count);
if (picks.length === 0) {
  console.log('No suggestions — every in-scope pair is logged or sits inside a known hub inner disk.');
} else {
  picks.forEach((s, i) => {
    const hub = s.hubDistanceKm != null ? ` · ${s.hubDistanceKm}km from ${s.hubName}` : '';
    console.log(`${i + 1}. ${s.pincode} (${s.area}) — ${s.platformId} — ${s.reason}${hub}`);
    console.log(`    ${s.placeString}  →  ${s.website ?? ''}`);
  });
}
