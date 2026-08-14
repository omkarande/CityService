/**
 * Hardcoded home-screen city rail. Only Pune has real seeded coverage data
 * (see src/data/localities.pune.json); every other city is presentation-only
 * for now — its areas have no `localityId`, so tapping one routes to the
 * Results screen's honest "we don't know this place yet" state rather than a
 * fabricated answer.
 *
 * Landmark photos are self-hosted in public/landmarks/, sourced from
 * Wikimedia Commons (CC BY-SA / public domain) via each article's page image.
 */

export interface FeaturedArea {
  label: string;
  /** Present only where we actually hold coverage data for this exact locality. */
  localityId?: string;
}

export interface FeaturedCity {
  id: string;
  name: string;
  landmark: string;
  image: string;
  seeded: boolean;
  areas: FeaturedArea[];
}

export const FEATURED_CITIES: FeaturedCity[] = [
  {
    id: 'pune',
    name: 'Pune',
    landmark: 'Shaniwar Wada',
    image: '/landmarks/pune.jpg',
    seeded: true,
    areas: [
      { label: 'Shinde Vasti', localityId: 'pune-chikhali-shinde-vasti' },
      { label: 'Baner', localityId: 'pune-baner' },
      { label: 'Hinjewadi', localityId: 'pune-hinjewadi' },
      { label: 'Kothrud', localityId: 'pune-kothrud' },
      { label: 'Wagholi', localityId: 'pune-wagholi' },
      { label: 'Hadapsar', localityId: 'pune-hadapsar' },
    ],
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    landmark: 'Gateway of India',
    image: '/landmarks/mumbai.jpg',
    seeded: false,
    areas: [{ label: 'Andheri' }, { label: 'Bandra' }, { label: 'Powai' }, { label: 'Thane' }],
  },
  {
    id: 'delhi',
    name: 'Delhi',
    landmark: 'Red Fort',
    image: '/landmarks/delhi.jpg',
    seeded: false,
    areas: [{ label: 'Connaught Place' }, { label: 'Dwarka' }, { label: 'Saket' }, { label: 'Rohini' }],
  },
  {
    id: 'bangalore',
    name: 'Bengaluru',
    landmark: 'Vidhana Soudha',
    image: '/landmarks/bangalore.jpg',
    seeded: false,
    areas: [
      { label: 'Koramangala' },
      { label: 'Whitefield' },
      { label: 'Indiranagar' },
      { label: 'Electronic City' },
    ],
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    landmark: 'Charminar',
    image: '/landmarks/hyderabad.jpg',
    seeded: false,
    areas: [{ label: 'Gachibowli' }, { label: 'Hitech City' }, { label: 'Secunderabad' }, { label: 'Kukatpally' }],
  },
  {
    id: 'chennai',
    name: 'Chennai',
    landmark: 'Marina Beach',
    image: '/landmarks/chennai.jpg',
    seeded: false,
    areas: [{ label: 'T. Nagar' }, { label: 'Velachery' }, { label: 'Adyar' }, { label: 'OMR' }],
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    landmark: 'Victoria Memorial',
    image: '/landmarks/kolkata.jpg',
    seeded: false,
    areas: [{ label: 'Salt Lake' }, { label: 'Park Street' }, { label: 'Howrah' }, { label: 'New Town' }],
  },
  {
    id: 'jaipur',
    name: 'Jaipur',
    landmark: 'Hawa Mahal',
    image: '/landmarks/jaipur.jpg',
    seeded: false,
    areas: [{ label: 'Malviya Nagar' }, { label: 'Vaishali Nagar' }, { label: 'C-Scheme' }],
  },
  {
    id: 'ahmedabad',
    name: 'Ahmedabad',
    landmark: 'Sabarmati Ashram',
    image: '/landmarks/ahmedabad.jpg',
    seeded: false,
    areas: [{ label: 'Satellite' }, { label: 'Navrangpura' }, { label: 'Bopal' }],
  },
];
