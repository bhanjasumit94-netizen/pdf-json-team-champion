import { Competitor } from '../types';

export const IPF_MEN_WEIGHTS = ['53', '59', '66', '74', '83', '93', '105', '120', '120+'];
export const IPF_WOMEN_WEIGHTS = ['43', '47', '52', '57', '63', '69', '76', '84', '84+'];
export const DIVISIONS = ['Sub-Junior', 'Junior', 'Senior', 'Open', 'Master 1', 'Master 2', 'Master 3', 'Master 4'] as const;
export const CATEGORIES = ['Sub-Junior', 'Junior', 'Senior', 'Master I', 'Master II', 'Master III'] as const;

export const OFFICIAL_DISTRICTS = [
  'Alipurduar',
  'Bankura',
  'Birbhum',
  'Cooch Behar',
  'Dakshin Dinajpur',
  'Darjeeling',
  'Hooghly',
  'Howrah',
  'Jalpaiguri',
  'Jhargram',
  'Kalimpong',
  'Kolkata',
  'Malda',
  'Murshidabad',
  'Nadia',
  'North 24 Parganas',
  'Paschim Bardhaman',
  'Paschim Medinipur',
  'Purba Bardhaman',
  'Purba Medinipur',
  'Purulia',
  'South 24 Parganas',
  'Uttar Dinajpur'
];

export const DISTRICT_ASSOCIATION_MAP: Record<string, string> = {
  'Alipurduar': 'Alipurduar District Powerlifting Association',
  'Bankura': 'Bankura District Association',
  'Birbhum': 'Birbhum District Association',
  'Cooch Behar': 'Cooch Behar District Powerlifting Association',
  'Dakshin Dinajpur': 'Dakshin Dinajpur District Powerlifting Association',
  'Darjeeling': 'Darjeeling District Association',
  'Hooghly': 'Hooghly District Powerlifting Association',
  'Howrah': 'Howrah District Athletic Association',
  'Jalpaiguri': 'Jalpaiguri District Association',
  'Jhargram': 'Jhargram District Association',
  'Kalimpong': 'Kalimpong District Association',
  'Kolkata': 'Kolkata District Powerlifting Association',
  'Malda': 'Malda District Powerlifting Association',
  'Murshidabad': 'Murshidabad District Association',
  'Nadia': 'Nadia District Powerlifting Association',
  'North 24 Parganas': 'North 24 Parganas District Association',
  'Paschim Bardhaman': 'Paschim Bardhaman District Physical Culture Association',
  'Paschim Medinipur': 'Paschim Medinipur District Association',
  'Purba Bardhaman': 'Purba Bardhaman District Association',
  'Purba Medinipur': 'Purba Medinipur District Association',
  'Purulia': 'Purulia District Association',
  'South 24 Parganas': 'South 24 Parganas District Association',
  'Uttar Dinajpur': 'Uttar Dinajpur District Association'
};

export const abbrevMap: Record<string, string> = {
  'HDPA': 'Hooghly',
  'PBDPCA': 'Paschim Bardhaman',
  'PBPCA': 'Purba Bardhaman',
  'NORTH 24 PGS': 'North 24 Parganas',
  'SOUTH 24 PGS': 'South 24 Parganas',
};

export function fuzzyMatchDistrict(input: string | null): {
  matchedDistrict: string | null;
  confidence: number;
} {
  if (!input) {
    return { matchedDistrict: null, confidence: 0 };
  }
  const original = input.trim();
  let s = original.toUpperCase();

  // Basic exact matches
  if (OFFICIAL_DISTRICTS.some(d => d.toUpperCase() === s)) {
    const found = OFFICIAL_DISTRICTS.find(d => d.toUpperCase() === s) || null;
    return { matchedDistrict: found, confidence: 100 };
  }

  // Abbreviation lookup
  for (const [abbr, repl] of Object.entries(abbrevMap)) {
    if (s === abbr || s.includes(' ' + abbr) || s.includes(abbr + ' ') || s.includes(abbr)) {
      return { matchedDistrict: repl, confidence: 100 };
    }
  }

  // Handle custom patterns
  if (s === 'P BARDHAMAN' || s === 'P. BARDHAMAN' || s === 'P BARDDHAMAN' || s === 'P-BARDHAMAN') {
    return { matchedDistrict: 'Paschim Bardhaman', confidence: 100 };
  }

  // Clean noise words
  const noiseList = [
    'DISTRICT',
    'PHYSICAL CULTURE ASSOCIATION',
    'POWERLIFTING ASSOCIATION',
    'ASSOCIATION',
    'CLUB',
    'TEAM'
  ];

  let cleaned = s.replace(/[^A-Z0-9\s]/g, ' ');
  for (const noise of noiseList) {
    const regex = new RegExp('\\b' + noise + '\\b', 'g');
    cleaned = cleaned.replace(regex, ' ');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    return { matchedDistrict: null, confidence: 0 };
  }

  // Compare cleaned to official
  let bestMatch: string | null = null;
  let highestScore = 0;

  const calculateSimilarity = (s1: string, s2: string): number => {
    const clean1 = s1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const clean2 = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (clean1 === clean2) return 100;
    if (!clean1 || !clean2) return 0;

    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      const minLen = Math.min(clean1.length, clean2.length);
      const maxLen = Math.max(clean1.length, clean2.length);
      if (minLen / maxLen >= 0.7) {
        return Math.round((minLen / maxLen) * 95);
      }
    }

    // Sorensen-Dice bi-gram
    const getBigrams = (str: string) => {
      const bgs = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) {
        bgs.add(str.substring(i, i + 2));
      }
      return bgs;
    };

    const b1 = getBigrams(clean1);
    const b2 = getBigrams(clean2);
    let inter = 0;
    b1.forEach(bg => {
      if (b2.has(bg)) inter++;
    });

    const dice = (2.0 * inter) / (b1.size + b2.size || 1);

    // Levenshtein
    const track = Array(clean2.length + 1).fill(null).map(() => Array(clean1.length + 1).fill(null));
    for (let i = 0; i <= clean1.length; i++) track[0][i] = i;
    for (let j = 0; j <= clean2.length; j++) track[j][0] = j;
    for (let j = 1; j <= clean2.length; j++) {
      for (let i = 1; i <= clean1.length; i++) {
        const cost = clean1[i - 1] === clean2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + cost
        );
      }
    }
    const levSimilarity = 1.0 - (track[clean2.length][clean1.length] / Math.max(clean1.length, clean2.length));
    const combined = (dice * 0.4) + (levSimilarity * 0.6);
    return Math.round(combined * 100);
  };

  for (const dist of OFFICIAL_DISTRICTS) {
    let dCleaned = dist.toUpperCase();
    for (const noise of noiseList) {
      const regex = new RegExp('\\b' + noise + '\\b', 'g');
      dCleaned = dCleaned.replace(regex, ' ');
    }
    dCleaned = dCleaned.replace(/\s+/g, ' ').trim();

    const score = Math.max(
      calculateSimilarity(cleaned, dCleaned),
      calculateSimilarity(original, dist)
    );

    if (score > highestScore) {
      highestScore = score;
      bestMatch = dist;
    }
  }

  return {
    matchedDistrict: highestScore >= 80 ? bestMatch : (highestScore >= 40 ? bestMatch : null),
    confidence: highestScore
  };
}

export function getValidationState(item: Competitor): 'complete' | 'needs_review' {
  if (item.importStatus === 'needs_review') return 'needs_review';
  if (!item.name || !item.gender || !item.bodyweight_category || (!item.category && !item.division) || !item.district) {
    return 'needs_review';
  }
  
  if (item.districtConfidence !== undefined && item.districtConfidence < 80 && !item.districtConfirmed) {
    return 'needs_review';
  }
  
  return 'complete';
}
