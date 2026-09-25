/**
 * Canonical demo entities for the Mypageseo frontend preview.
 *
 * Every demo module derives from these facts so the whole application reads as
 * one connected fictional account. Location ids match the workspace provider.
 */
import { demoDate, pickInt, seedFrom } from "./demo-mode";

export type DemoLocationFacts = {
  id: string;
  clientId: string;
  businessName: string;
  city: string;
  state: string;
  area: string;
  street: string;
  postalCode: string;
  phone: string;
  website: string;
  primaryCategory: string;
  additionalCategories: string[];
  visibility: number;
  visibilityChange: number;
  averageRank: number;
  averageRankChange: number;
  gbpHealth: number;
  rating: number;
  reviewCount: number;
  unansweredReviews: number;
  reviewsLast30: number;
  citationHealth: number;
  citationTotal: number;
  citationIssues: number;
  photoCount: number;
  localPackCoverage: number;
  /** Optional operational state used by list screens. */
  state_: "active" | "setup_required" | "disconnected";
};

export const DEMO_ORGANIZATIONS = {
  business: { id: "org_business", name: "Riverside Dental Group" },
  agency: { id: "org_agency", name: "Northbound Digital" },
} as const;

export const DEMO_CLIENTS = [
  { id: "cl_riverside", name: "Riverside Dental Group", industry: "Dental" },
  { id: "cl_hearth", name: "Hearth & Oak Restaurants", industry: "Restaurants" },
  { id: "cl_summit", name: "Summit Auto Care", industry: "Automotive" },
  { id: "cl_lumen", name: "Lumen Family Law", industry: "Legal" },
] as const;

export const DEMO_LOCATIONS: DemoLocationFacts[] = [
  {
    id: "loc_riverside_north",
    clientId: "cl_riverside",
    businessName: "Riverside Dental — North Austin",
    city: "Austin",
    state: "TX",
    area: "Austin, TX",
    street: "8420 Burnet Rd, Suite 210",
    postalCode: "78757",
    phone: "(512) 555-0148",
    website: "https://riversidedental.com/north-austin",
    primaryCategory: "Dentist",
    additionalCategories: ["Cosmetic dentist", "Emergency dental service"],
    visibility: 72,
    visibilityChange: 4.8,
    averageRank: 8.6,
    averageRankChange: -1.2,
    gbpHealth: 84,
    rating: 4.6,
    reviewCount: 412,
    unansweredReviews: 9,
    reviewsLast30: 17,
    citationHealth: 81,
    citationTotal: 64,
    citationIssues: 12,
    photoCount: 148,
    localPackCoverage: 63,
    state_: "active",
  },
  {
    id: "loc_riverside_south",
    clientId: "cl_riverside",
    businessName: "Riverside Dental — South Congress",
    city: "Austin",
    state: "TX",
    area: "Austin, TX",
    street: "1907 S Congress Ave",
    postalCode: "78704",
    phone: "(512) 555-0192",
    website: "https://riversidedental.com/south-congress",
    primaryCategory: "Dentist",
    additionalCategories: ["Pediatric dentist"],
    visibility: 61,
    visibilityChange: -3.2,
    averageRank: 12.4,
    averageRankChange: 1.8,
    gbpHealth: 68,
    rating: 4.3,
    reviewCount: 208,
    unansweredReviews: 21,
    reviewsLast30: 11,
    citationHealth: 64,
    citationTotal: 58,
    citationIssues: 19,
    photoCount: 73,
    localPackCoverage: 44,
    state_: "active",
  },
  {
    id: "loc_riverside_round_rock",
    clientId: "cl_riverside",
    businessName: "Riverside Dental — Round Rock",
    city: "Round Rock",
    state: "TX",
    area: "Round Rock, TX",
    street: "215 University Blvd",
    postalCode: "78665",
    phone: "(512) 555-0166",
    website: "https://riversidedental.com/round-rock",
    primaryCategory: "Dentist",
    additionalCategories: ["Dental implants periodontist"],
    visibility: 38,
    visibilityChange: 6.4,
    averageRank: 18.9,
    averageRankChange: -2.6,
    gbpHealth: 52,
    rating: 4.8,
    reviewCount: 96,
    unansweredReviews: 3,
    reviewsLast30: 6,
    citationHealth: 47,
    citationTotal: 41,
    citationIssues: 22,
    photoCount: 28,
    localPackCoverage: 26,
    state_: "setup_required",
  },
  {
    id: "loc_hearth_downtown",
    clientId: "cl_hearth",
    businessName: "Hearth & Oak — Downtown",
    city: "Denver",
    state: "CO",
    area: "Denver, CO",
    street: "1544 Blake St",
    postalCode: "80202",
    phone: "(303) 555-0117",
    website: "https://hearthandoak.com/downtown",
    primaryCategory: "American restaurant",
    additionalCategories: ["Bar", "Brunch restaurant"],
    visibility: 78,
    visibilityChange: 2.1,
    averageRank: 6.8,
    averageRankChange: -0.7,
    gbpHealth: 91,
    rating: 4.4,
    reviewCount: 1287,
    unansweredReviews: 34,
    reviewsLast30: 62,
    citationHealth: 88,
    citationTotal: 71,
    citationIssues: 7,
    photoCount: 612,
    localPackCoverage: 71,
    state_: "active",
  },
  {
    id: "loc_hearth_cherry",
    clientId: "cl_hearth",
    businessName: "Hearth & Oak — Cherry Creek",
    city: "Denver",
    state: "CO",
    area: "Denver, CO",
    street: "2790 E 2nd Ave",
    postalCode: "80206",
    phone: "(303) 555-0154",
    website: "https://hearthandoak.com/cherry-creek",
    primaryCategory: "American restaurant",
    additionalCategories: ["Wine bar"],
    visibility: 49,
    visibilityChange: -7.6,
    averageRank: 16.2,
    averageRankChange: 3.4,
    gbpHealth: 57,
    rating: 4.1,
    reviewCount: 634,
    unansweredReviews: 48,
    reviewsLast30: 29,
    citationHealth: 59,
    citationTotal: 63,
    citationIssues: 24,
    photoCount: 204,
    localPackCoverage: 33,
    state_: "active",
  },
  {
    id: "loc_summit_main",
    clientId: "cl_summit",
    businessName: "Summit Auto Care",
    city: "Boise",
    state: "ID",
    area: "Boise, ID",
    street: "4110 W Overland Rd",
    postalCode: "83705",
    phone: "(208) 555-0173",
    website: "https://summitautocare.com",
    primaryCategory: "Auto repair shop",
    additionalCategories: ["Brake shop", "Oil change service"],
    visibility: 67,
    visibilityChange: 0.4,
    averageRank: 10.1,
    averageRankChange: -0.3,
    gbpHealth: 76,
    rating: 4.7,
    reviewCount: 318,
    unansweredReviews: 6,
    reviewsLast30: 14,
    citationHealth: 74,
    citationTotal: 55,
    citationIssues: 13,
    photoCount: 96,
    localPackCoverage: 52,
    state_: "active",
  },
  {
    id: "loc_lumen_main",
    clientId: "cl_lumen",
    businessName: "Lumen Family Law",
    city: "Portland",
    state: "OR",
    area: "Portland, OR",
    street: "1220 SW Morrison St, Suite 900",
    postalCode: "97205",
    phone: "(503) 555-0129",
    website: "https://lumenfamilylaw.com",
    primaryCategory: "Family law attorney",
    additionalCategories: ["Divorce lawyer"],
    visibility: 44,
    visibilityChange: 1.6,
    averageRank: 14.7,
    averageRankChange: -0.9,
    gbpHealth: 63,
    rating: 4.9,
    reviewCount: 74,
    unansweredReviews: 2,
    reviewsLast30: 4,
    citationHealth: 56,
    citationTotal: 38,
    citationIssues: 16,
    photoCount: 34,
    localPackCoverage: 29,
    state_: "disconnected",
  },
];

export const DEMO_PRIMARY_LOCATION_ID = "loc_riverside_north";

export function demoLocation(locationId?: string | null): DemoLocationFacts {
  return (
    DEMO_LOCATIONS.find((l) => l.id === locationId) ??
    DEMO_LOCATIONS.find((l) => l.id === DEMO_PRIMARY_LOCATION_ID)!
  );
}

export function demoLocationsForClient(clientId: string): DemoLocationFacts[] {
  return DEMO_LOCATIONS.filter((l) => l.clientId === clientId);
}

/** Keyword themes per industry, used to build tracked-keyword sets. */
const KEYWORD_THEMES: Record<string, { group: string; terms: string[] }[]> = {
  cl_riverside: [
    {
      group: "General dentistry",
      terms: [
        "dentist near me",
        "family dentist {city}",
        "dental cleaning {city}",
        "affordable dentist {city}",
        "new patient dentist {city}",
        "dental checkup near me",
      ],
    },
    {
      group: "Cosmetic",
      terms: [
        "teeth whitening {city}",
        "veneers {city}",
        "cosmetic dentist {city}",
        "smile makeover {city}",
        "invisalign {city}",
      ],
    },
    {
      group: "Emergency",
      terms: [
        "emergency dentist {city}",
        "same day dentist near me",
        "tooth pain dentist {city}",
        "broken tooth repair {city}",
      ],
    },
    {
      group: "Implants",
      terms: [
        "dental implants {city}",
        "implant dentist near me",
        "full arch implants {city}",
        "tooth replacement {city}",
      ],
    },
    {
      group: "Pediatric",
      terms: ["kids dentist {city}", "pediatric dentist near me", "children dental care {city}"],
    },
  ],
  cl_hearth: [
    {
      group: "Dining",
      terms: [
        "restaurants near me",
        "american restaurant {city}",
        "best dinner {city}",
        "farm to table {city}",
        "date night restaurant {city}",
      ],
    },
    {
      group: "Brunch",
      terms: ["brunch {city}", "weekend brunch near me", "bottomless brunch {city}"],
    },
    {
      group: "Bar",
      terms: ["cocktail bar {city}", "happy hour {city}", "wine bar near me"],
    },
    {
      group: "Private events",
      terms: ["private dining {city}", "event space restaurant {city}"],
    },
  ],
  cl_summit: [
    {
      group: "Repair",
      terms: [
        "auto repair {city}",
        "mechanic near me",
        "check engine light {city}",
        "transmission repair {city}",
      ],
    },
    { group: "Maintenance", terms: ["oil change {city}", "tire rotation near me", "brake service {city}"] },
    { group: "Diagnostics", terms: ["car diagnostics {city}", "pre purchase inspection {city}"] },
  ],
  cl_lumen: [
    {
      group: "Family law",
      terms: ["family law attorney {city}", "divorce lawyer {city}", "child custody lawyer near me"],
    },
    { group: "Mediation", terms: ["divorce mediation {city}", "custody mediation {city}"] },
  ],
};

export type DemoKeyword = {
  id: string;
  keyword: string;
  group: string;
  resultType: "google" | "local_finder";
  currentPosition: number | null;
  previousPosition: number | null;
  searchVolume: number;
};

/**
 * Tracked keyword set for a location. Positions are deterministic and scale
 * with the location's average rank so screens stay mutually consistent.
 */
export function demoKeywords(locationId?: string | null): DemoKeyword[] {
  const location = demoLocation(locationId);
  const themes = KEYWORD_THEMES[location.clientId] ?? KEYWORD_THEMES["cl_riverside"]!;
  const rows: DemoKeyword[] = [];
  themes.forEach((theme) => {
    theme.terms.forEach((term, index) => {
      const keyword = term.replace("{city}", location.city.toLowerCase());
      const seed = seedFrom(location.id, keyword);
      const spread = pickInt(seed, -6, 12);
      const raw = Math.round(location.averageRank + spread);
      const current = raw < 1 ? 1 : raw > 60 ? null : raw;
      const drift = pickInt(seed + 7, -4, 4);
      const previousRaw = current === null ? null : Math.max(1, current + drift);
      rows.push({
        id: `kw_${location.id}_${rows.length + 1}`,
        keyword,
        group: theme.group,
        resultType: index % 3 === 0 ? "local_finder" : "google",
        currentPosition: current,
        previousPosition: previousRaw,
        searchVolume: pickInt(seed + 13, 90, 2400),
      });
    });
  });
  return rows;
}

export type DemoCompetitor = {
  id: string;
  name: string;
  website: string;
  averageRank: number;
  rating: number;
  reviewCount: number;
  photoCount: number;
  citationCount: number;
  linkingDomains: number;
  backlinks: number;
  domainAuthority: number;
  primaryCategory: string;
  localPackShare: number;
};

const COMPETITOR_NAMES: Record<string, string[]> = {
  cl_riverside: [
    "Lakeline Family Dental",
    "Bright Arbor Dentistry",
    "Congress Avenue Smiles",
    "Hill Country Dental Studio",
    "Northgate Dental Care",
  ],
  cl_hearth: [
    "Copper Kettle Kitchen",
    "Union Station Chophouse",
    "Larimer Social",
    "The Gilded Fork",
  ],
  cl_summit: ["Foothills Automotive", "Overland Tire & Service", "Boise Bench Motors"],
  cl_lumen: ["Rosewood Family Law", "Willamette Legal Group", "Pearl District Attorneys"],
};

export function demoCompetitors(locationId?: string | null): DemoCompetitor[] {
  const location = demoLocation(locationId);
  const names = COMPETITOR_NAMES[location.clientId] ?? COMPETITOR_NAMES["cl_riverside"]!;
  return names.map((name, index) => {
    const seed = seedFrom(location.id, name);
    return {
      id: `comp_${location.id}_${index + 1}`,
      name,
      website: `https://${name.toLowerCase().replace(/[^a-z]+/g, "")}.com`,
      averageRank: Number((location.averageRank + pickInt(seed, -5, 8)).toFixed(1)),
      rating: Number((3.8 + pickInt(seed + 3, 0, 11) / 10).toFixed(1)),
      reviewCount: pickInt(seed + 5, 60, 1400),
      photoCount: pickInt(seed + 9, 20, 480),
      citationCount: pickInt(seed + 11, 24, 92),
      linkingDomains: pickInt(seed + 17, 18, 240),
      backlinks: pickInt(seed + 19, 90, 3800),
      domainAuthority: pickInt(seed + 23, 12, 58),
      primaryCategory: location.primaryCategory,
      localPackShare: pickInt(seed + 29, 8, 64),
    };
  });
}

/** Directories used consistently by citation screens. */
export const DEMO_DIRECTORIES = [
  "Google Business Profile",
  "Apple Business Connect",
  "Bing Places",
  "Yelp",
  "Facebook",
  "Foursquare",
  "Better Business Bureau",
  "Yellow Pages",
  "MapQuest",
  "Nextdoor",
  "Superpages",
  "Chamber of Commerce",
  "Citysearch",
  "Manta",
  "Hotfrog",
  "Angi",
  "Brownbook",
  "Local.com",
  "Data Axle",
  "Neustar Localeze",
  "Infogroup",
  "Factual",
  "Foursquare Places",
  "TomTom",
  "HERE Maps",
  "Waze",
  "Trustpilot",
  "Thumbtack",
  "HomeAdvisor",
  "Porch",
  "Houzz",
  "Nextdoor Business",
  "Chamberofcommerce.com",
  "EZLocal",
  "eLocal",
  "ShowMeLocal",
  "Tupalo",
  "Cylex",
  "USCity.net",
  "n49",
  "Fyple",
  "iGlobal",
  "Opendi",
  "2findlocal",
  "GoLocal247",
  "MerchantCircle",
  "Kompass",
  "Yasabe",
  "Yellowbot",
  "Judy's Book",
  "Insider Pages",
  "Local Database",
  "City Squares",
  "Yalwa",
  "Getfave",
  "Wand",
  "Ibegin",
  "Where To",
  "US Business Directory",
  "Enroll Business",
  "Salespider",
  "eBusinessPages",
  "Brand Yourself",
  "Yellowise",
  "Tuugo",
  "Storeboard",
  "Bizvotes",
  "Localstack",
  "AboutUs",
  "Chamber Business Directory",
  "iBegin Local",
  "Yellow.Place",
  "Golden Pages",
  "Superpages Business",
  "DexKnows",
  "WhitePages Business",
  "Yellowpages.ca",
  "Spoke",
  "Nextdoor Neighborhood",
  "Bizapedia",
  "OpenCorporates",
  "Dun & Bradstreet",
  "CorporationWiki",
  "Buzzfile",
] as const;

export const DEMO_LAST_SYNC = demoDate(1);
