export interface Competitor {
  id: string;
  district: string | null;
  districtAssociation: string | null;
  name: string;
  gender: 'Men' | 'Women';
  bodyweight_category: string | null;
  division: 'Sub-Junior' | 'Junior' | 'Senior' | 'Open' | 'Master 1' | 'Master 2' | 'Master 3' | 'Master 4' | null;
  category: string | null;
  entry_fee: number | null;
  source_page: number | null;
  
  // OCR/Parsing Validation fields
  rawExtractedDistrict?: string | null;
  districtConfidence?: number;
  districtConfirmed?: boolean;

  // Persistent registration parameters
  attempts_squat?: string;
  attempts_bench?: string;
  attempts_deadlift?: string;
  phone_number?: string;
  notes?: string;

  importStatus?: 'complete' | 'needs_review';
}

export interface UploadedFileState {
  name: string;
  size: number;
  status: 'parsing' | 'success' | 'warning' | 'error';
  errorMsg?: string;
  count?: number;
  needsReviewCount?: number;
  missingFields?: {
    gender: number;
    bodyWeight: number;
    category: number;
    fee: number;
  };
}
