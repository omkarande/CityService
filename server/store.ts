import pg from 'pg';
import type { Category, Coverage, Locality, Platform } from '../src/api/types.ts';
import { loadSeedCatalog } from '../src/domain/seedCatalog.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  brand_color TEXT NOT NULL,
  logo_url TEXT,
  initials TEXT NOT NULL,
  website TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS localities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]',
  kind TEXT NOT NULL,
  parent_id TEXT,
  pincode TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS coverage (
  platform_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL,
  details JSONB,
  PRIMARY KEY (platform_id, area_id)
);
`;

function localityFromRow(row: {
  id: string;
  name: string;
  aliases: string[];
  kind: Locality['kind'];
  parent_id: string | null;
  pincode: string | null;
  city: string;
  state: string;
  lat: number;
  lng: number;
}): Locality {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    kind: row.kind,
    parentId: row.parent_id,
    pincode: row.pincode,
    city: row.city,
    state: row.state,
    center: { lat: row.lat, lng: row.lng },
  };
}

function platformFromRow(row: {
  id: string;
  name: string;
  category_id: Platform['categoryId'];
  brand_color: string;
  logo_url: string | null;
  initials: string;
  website: string;
}): Platform {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    brandColor: row.brand_color,
    ...(row.logo_url ? { logoUrl: row.logo_url } : {}),
    initials: row.initials,
    website: row.website,
  };
}

function coverageFromRow(row: {
  platform_id: string;
  area_id: string;
  status: Coverage['status'];
  source: Coverage['source'];
  last_verified_at: Date | string;
  evidence: Coverage['evidence'];
  details: Coverage['details'] | null;
}): Coverage {
  const lastVerifiedAt =
    row.last_verified_at instanceof Date ? row.last_verified_at.toISOString() : String(row.last_verified_at);
  return {
    platformId: row.platform_id,
    areaId: row.area_id,
    status: row.status,
    source: row.source,
    lastVerifiedAt,
    evidence: row.evidence,
    ...(row.details ? { details: row.details } : {}),
  };
}

export interface DataStore {
  categories(): Promise<Category[]>;
  platforms(): Promise<Platform[]>;
  localities(): Promise<Locality[]>;
  coverage(): Promise<Coverage[]>;
  upsertCoverage(record: Coverage): Promise<Coverage>;
  insertLocality(place: Locality): Promise<Locality>;
}

class MemoryStore implements DataStore {
  private cats: Category[];
  private plats: Platform[];
  private locs: Locality[];
  private cov: Coverage[];

  constructor() {
    const seed = loadSeedCatalog();
    this.cats = seed.categories;
    this.plats = seed.platforms;
    this.locs = seed.localities;
    this.cov = seed.coverage;
  }

  async categories() {
    return this.cats;
  }
  async platforms() {
    return this.plats;
  }
  async localities() {
    return this.locs;
  }
  async coverage() {
    return this.cov;
  }
  async upsertCoverage(record: Coverage) {
    const i = this.cov.findIndex((r) => r.platformId === record.platformId && r.areaId === record.areaId);
    if (i >= 0) this.cov[i] = record;
    else this.cov.push(record);
    return record;
  }

  async insertLocality(place: Locality) {
    const i = this.locs.findIndex((l) => l.id === place.id);
    if (i >= 0) this.locs[i] = place;
    else this.locs.push(place);
    return place;
  }
}

class PostgresStore implements DataStore {
  constructor(private pool: pg.Pool) {}

  async categories() {
    const { rows } = await this.pool.query('SELECT id, label, icon FROM categories ORDER BY id');
    return rows as Category[];
  }

  async platforms() {
    const { rows } = await this.pool.query(
      'SELECT id, name, category_id, brand_color, logo_url, initials, website FROM platforms ORDER BY name',
    );
    return rows.map(platformFromRow);
  }

  async localities() {
    const { rows } = await this.pool.query(
      'SELECT id, name, aliases, kind, parent_id, pincode, city, state, lat, lng FROM localities',
    );
    return rows.map(localityFromRow);
  }

  async coverage() {
    const { rows } = await this.pool.query(
      'SELECT platform_id, area_id, status, source, last_verified_at, evidence, details FROM coverage',
    );
    return rows.map(coverageFromRow);
  }

  async upsertCoverage(record: Coverage) {
    await this.pool.query(
      `INSERT INTO coverage (platform_id, area_id, status, source, last_verified_at, evidence, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
       ON CONFLICT (platform_id, area_id) DO UPDATE SET
         status = EXCLUDED.status,
         source = EXCLUDED.source,
         last_verified_at = EXCLUDED.last_verified_at,
         evidence = EXCLUDED.evidence,
         details = EXCLUDED.details`,
      [
        record.platformId,
        record.areaId,
        record.status,
        record.source,
        record.lastVerifiedAt,
        JSON.stringify(record.evidence),
        record.details ? JSON.stringify(record.details) : null,
      ],
    );
    return record;
  }

  async insertLocality(place: Locality) {
    await this.pool.query(
      `INSERT INTO localities (id, name, aliases, kind, parent_id, pincode, city, state, lat, lng)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         aliases = EXCLUDED.aliases,
         kind = EXCLUDED.kind,
         parent_id = EXCLUDED.parent_id,
         pincode = EXCLUDED.pincode,
         city = EXCLUDED.city,
         state = EXCLUDED.state,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng`,
      [
        place.id,
        place.name,
        JSON.stringify(place.aliases),
        place.kind,
        place.parentId,
        place.pincode,
        place.city,
        place.state,
        place.center.lat,
        place.center.lng,
      ],
    );
    return place;
  }
}

async function seedPostgres(pool: pg.Pool) {
  await pool.query(SCHEMA);
  const seed = loadSeedCatalog();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of seed.categories) {
      await client.query(
        `INSERT INTO categories (id, label, icon) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, icon = EXCLUDED.icon`,
        [c.id, c.label, c.icon],
      );
    }
    for (const p of seed.platforms) {
      await client.query(
        `INSERT INTO platforms (id, name, category_id, brand_color, logo_url, initials, website)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           category_id = EXCLUDED.category_id,
           brand_color = EXCLUDED.brand_color,
           logo_url = EXCLUDED.logo_url,
           initials = EXCLUDED.initials,
           website = EXCLUDED.website`,
        [p.id, p.name, p.categoryId, p.brandColor, p.logoUrl ?? null, p.initials, p.website],
      );
    }
    for (const l of seed.localities) {
      await client.query(
        `INSERT INTO localities (id, name, aliases, kind, parent_id, pincode, city, state, lat, lng)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           aliases = EXCLUDED.aliases,
           kind = EXCLUDED.kind,
           parent_id = EXCLUDED.parent_id,
           pincode = EXCLUDED.pincode,
           city = EXCLUDED.city,
           state = EXCLUDED.state,
           lat = EXCLUDED.lat,
           lng = EXCLUDED.lng
         WHERE localities.id NOT LIKE 'gps-%'`,
        [
          l.id,
          l.name,
          JSON.stringify(l.aliases),
          l.kind,
          l.parentId,
          l.pincode,
          l.city,
          l.state,
          l.center.lat,
          l.center.lng,
        ],
      );
    }
    for (const r of seed.coverage) {
      await client.query(
        `INSERT INTO coverage (platform_id, area_id, status, source, last_verified_at, evidence, details)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
         ON CONFLICT (platform_id, area_id) DO UPDATE SET
           status = EXCLUDED.status,
           source = EXCLUDED.source,
           last_verified_at = EXCLUDED.last_verified_at,
           evidence = EXCLUDED.evidence,
           details = EXCLUDED.details
         WHERE coverage.source IS DISTINCT FROM 'probe'`,
        [
          r.platformId,
          r.areaId,
          r.status,
          r.source,
          r.lastVerifiedAt,
          JSON.stringify(r.evidence),
          r.details ? JSON.stringify(r.details) : null,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createStore(): Promise<{ store: DataStore; usingPostgres: boolean }> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[cityservice] DATABASE_URL not set — using in-memory store (data resets on restart).');
    return { store: new MemoryStore(), usingPostgres: false };
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  });
  await seedPostgres(pool);
  console.warn('[cityservice] Postgres connected; catalog upserted (probe rows and GPS places kept).');
  return { store: new PostgresStore(pool), usingPostgres: true };
}
