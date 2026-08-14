import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { CategoryId, CoverageStatus, Locality, ResolvedCoverage, SourceKind, Verdict } from '../api/types';
import ConfidenceMeter from '../components/ConfidenceMeter';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import LogoTile from '../components/LogoTile';
import StatusBadge from '../components/StatusBadge';
import TopBar from '../components/TopBar';
import { COVERAGE_LABEL, TIER_LABEL, formatEta, relativeTime } from '../lib/format';

/** What the platform is for, so the headline reads like a sentence. */
const ACTION_BY_CATEGORY: Record<CategoryId, string> = {
  'ride-hailing': 'book rides',
  'bike-taxi': 'book bike taxis',
  'food-delivery': 'order food',
  'quick-commerce': 'get quick deliveries',
  grocery: 'order groceries',
  ecommerce: 'get deliveries',
  courier: 'book pickups',
  'home-services': 'book services',
  pharmacy: 'order medicines',
};

const SOURCE_LABEL: Record<SourceKind, string> = {
  official: "The platform's own coverage data",
  probe: 'Automated availability check',
  seed: 'Manually verified entry',
  'user-report': 'User reports',
  'seed-placeholder': 'Placeholder demo data — not verified',
};

const PATH_EXPLANATION: Record<ResolvedCoverage['resolvedFrom'], string> = {
  exact: 'Recorded for this exact locality.',
  pincode: 'Borrowed from a neighbouring area on the same pincode.',
  polygon: 'Derived from the coverage area this location falls inside.',
  city: 'Inferred from wider city data, not checked for this locality.',
  none: 'Nobody has recorded anything for this area yet.',
};

function headline(status: CoverageStatus, name: string, categoryId: CategoryId) {
  const action = ACTION_BY_CATEGORY[categoryId];
  switch (status) {
    case 'available':
      return { title: `${name} is available here`, body: `You can ${action} in this area.` };
    case 'partial':
      return { title: `${name} is patchy here`, body: `Some addresses can ${action}, others can't. Check your exact pin.` };
    case 'unavailable':
      return { title: `${name} isn't available here`, body: `You can't ${action} at this address.` };
    default:
      return { title: `We don't know about ${name} here`, body: 'Nobody has checked this area yet. Be the first.' };
  }
}

const HERO_TONE: Record<CoverageStatus, { wrap: string; icon: string; symbol: string }> = {
  available: { wrap: 'bg-success-container', icon: 'text-success-bright', symbol: 'check_circle' },
  partial: { wrap: 'bg-warning-container', icon: 'text-warning-bright', symbol: 'error' },
  unavailable: { wrap: 'bg-danger-container', icon: 'text-danger-bright', symbol: 'cancel' },
  unknown: { wrap: 'bg-neutral-container', icon: 'text-neutral', symbol: 'help' },
};

export default function PlatformDetail() {
  const { localityId = '', platformId = '' } = useParams();

  const [data, setData] = useState<{ locality: Locality; breadcrumb: string[]; resolved: ResolvedCoverage } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [myVerdict, setMyVerdict] = useState<Verdict | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justReported, setJustReported] = useState(false);

  const load = useCallback(async () => {
    const result = await api.getPlatformAt(localityId, platformId);
    setData(result);
    setMyVerdict(api.myReport(platformId, localityId)?.verdict ?? null);
    setLoading(false);
  }, [localityId, platformId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function report(verdict: Verdict) {
    setSubmitting(true);
    await api.submitReport({ platformId, areaId: localityId, verdict, atLocation: false });
    await load();
    setSubmitting(false);
    setJustReported(true);
  }

  if (loading) {
    return (
      <>
        <TopBar back backLabel="Back" />
        <div className="px-margin-mobile py-lg text-body-md text-on-surface-variant">Loading…</div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <TopBar back backLabel="Back" />
        <div className="px-margin-mobile py-lg">
          <EmptyState icon="search_off" title="Not found" body="That platform or locality doesn't exist." />
        </div>
      </>
    );
  }

  const { locality, resolved } = data;
  const { platform, status, tier, details, caveat, source, lastVerifiedAt, resolvedFrom, resolvedAreaName } = resolved;
  const tone = HERO_TONE[status];
  const copy = headline(status, platform.name, platform.categoryId);
  const eta = formatEta(details?.etaMinutes);

  return (
    <>
      <TopBar back backLabel="Back to results" />

      <div className="animate-fade-up flex flex-col gap-md px-margin-mobile pb-lg pt-md">
        <p className="text-body-md text-on-surface-variant">
          <Icon name="location_on" size={14} className="align-text-bottom" /> {locality.name}
          {locality.pincode && ` · ${locality.pincode}`}
        </p>

        <div className="overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest shadow-soft">
          {/* Identity */}
          <div className="flex items-center gap-md p-md">
            <LogoTile platform={platform} size="lg" muted={status === 'unavailable' || status === 'unknown'} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-headline-md font-headline-md text-on-surface">{platform.name}</h2>
              <p className="text-body-md capitalize text-on-surface-variant">
                {platform.categoryId.replace('-', ' ')}
              </p>
            </div>
            <StatusBadge status={status} />
          </div>

          {/* The answer, in a sentence */}
          <div className={`flex items-start gap-3 px-md py-4 ${tone.wrap}`}>
            <Icon name={tone.symbol} className={tone.icon} fill size={28} />
            <div>
              <p className="text-body-lg font-bold text-on-surface">{copy.title}</p>
              <p className="text-body-md text-on-surface-variant">{copy.body}</p>
            </div>
          </div>

          {/* Facts */}
          {(eta || details?.coverageStrength) && (
            <div className="grid grid-cols-2 divide-x divide-outline-variant/40 border-t border-outline-variant/40">
              <Fact label={platform.categoryId.includes('ride') || platform.categoryId.includes('taxi') ? 'Est. wait time' : 'Est. delivery'}>
                {eta ?? '—'}
              </Fact>
              <Fact label="Coverage">
                {details?.coverageStrength ? COVERAGE_LABEL[details.coverageStrength] : '—'}
              </Fact>
            </div>
          )}

          {details?.note && (
            <p className="border-t border-outline-variant/40 px-md py-3 text-body-md text-on-surface-variant">
              <Icon name="info" size={16} className="align-text-bottom text-outline" /> {details.note}
            </p>
          )}

          {/* Provenance — the part that makes the answer trustworthy */}
          <div className="border-t border-outline-variant/40">
            <Row icon="schedule" label="Last updated" value={relativeTime(lastVerifiedAt)} />
            <Row icon="groups" label="Source" value={source ? SOURCE_LABEL[source] : 'No data'} />
            <Row
              icon="hub"
              label="How we know"
              value={PATH_EXPLANATION[resolvedFrom]}
              sub={resolvedAreaName && resolvedFrom !== 'exact' ? `From: ${resolvedAreaName}` : undefined}
            />
            <div className="flex items-center justify-between px-md py-3">
              <span className="flex items-center gap-3">
                <Icon name="verified" size={20} className="text-outline" />
                <span className="text-body-md text-on-surface-variant">Confidence</span>
              </span>
              <ConfidenceMeter tier={tier} />
            </div>
          </div>

          {caveat && (
            <p className="flex items-start gap-2 border-t border-outline-variant/40 bg-surface-container-low px-md py-3 text-body-md text-on-surface-variant">
              <Icon name="priority_high" size={16} className="mt-0.5 text-warning" />
              {caveat}
            </p>
          )}

          {/* Reporting */}
          <div className="border-t border-outline-variant/40 p-md">
            <p className="mb-2 text-body-lg font-bold text-on-surface">Is this right?</p>
            <p className="mb-3 text-body-md text-on-surface-variant">
              Your answer is the only thing that turns a guess into a fact.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <VoteButton
                tone="positive"
                icon="thumb_up"
                label="Yes, it works"
                active={myVerdict === 'works'}
                disabled={submitting}
                onClick={() => report('works')}
              />
              <VoteButton
                tone="negative"
                icon="thumb_down"
                label="Not working"
                active={myVerdict === 'not-working'}
                disabled={submitting}
                onClick={() => report('not-working')}
              />
            </div>

            {justReported && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-success-container px-3 py-2 text-body-md text-success">
                <Icon name="check" size={16} />
                Recorded — confidence is now “{TIER_LABEL[tier]}”.
              </p>
            )}
          </div>
        </div>

        <a
          href={platform.website}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-body-md font-bold text-on-primary transition-colors hover:bg-primary-container active:scale-[0.98]"
        >
          Open {platform.name}
          <Icon name="open_in_new" size={18} />
        </a>
      </div>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-md py-4">
      <p className="text-body-md text-on-surface-variant">{label}</p>
      <p className="text-headline-md font-headline-md font-bold text-on-surface">{children}</p>
    </div>
  );
}

function Row({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-outline-variant/40 px-md py-3 last:border-b-0">
      <span className="flex shrink-0 items-center gap-3">
        <Icon name={icon} size={20} className="text-outline" />
        <span className="text-body-md text-on-surface-variant">{label}</span>
      </span>
      <span className="min-w-0 text-right">
        <span className="block text-body-md font-semibold text-on-surface">{value}</span>
        {sub && <span className="block text-label-sm text-on-surface-variant">{sub}</span>}
      </span>
    </div>
  );
}

function VoteButton({
  tone,
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  tone: 'positive' | 'negative';
  icon: string;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const palette =
    tone === 'positive'
      ? { idle: 'border-success/30 text-success hover:bg-success-container', on: 'border-success bg-success-container' }
      : { idle: 'border-danger/30 text-danger hover:bg-danger-container', on: 'border-danger bg-danger-container' };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        'flex flex-col items-center gap-1 rounded-lg border-2 py-3 text-body-md font-bold transition-all active:scale-95 disabled:opacity-50',
        palette.idle,
        active ? palette.on : 'bg-surface-container-lowest',
      ].join(' ')}
    >
      <Icon name={icon} fill={active} size={22} />
      {label}
    </button>
  );
}
