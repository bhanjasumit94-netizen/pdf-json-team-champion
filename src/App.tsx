import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  Plus, 
  Copy, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Edit3, 
  Save, 
  X, 
  SlidersHorizontal,
  FolderOpen,
  UserCheck,
  Award,
  CircleDollarSign,
  TrendingUp,
  MapPin,
  Search,
  Filter,
  Check,
  Settings,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Info,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';
// @ts-ignore
import tesseractWorkerUrl from 'tesseract.js/dist/worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Modular Imports
import { Competitor, UploadedFileState } from './types';
import { 
  OFFICIAL_DISTRICTS, 
  DISTRICT_ASSOCIATION_MAP, 
  IPF_MEN_WEIGHTS, 
  IPF_WOMEN_WEIGHTS, 
  DIVISIONS, 
  CATEGORIES, 
  fuzzyMatchDistrict, 
  getValidationState 
} from './utils/districtUtils';
import { DetailsDrawer } from './components/DetailsDrawer';
import { ManualEntryModal } from './components/ManualEntryModal';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { DuplicateResolutionModal } from './components/DuplicateResolutionModal';

const renderMissing = () => <span className="text-[#FFB547] italic text-[10px] bg-[#FFB547]/10 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Missing</span>;

export default function App() {
  // --- STATE SYSTEM ---
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Roster Filter Systems
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState<string>('All');
  const [filterDivision, setFilterDivision] = useState<string>('All');
  const [filterDistrict, setFilterDistrict] = useState<string>('All');
  const [filterValidation, setFilterValidation] = useState<string>('All'); // All, Valid, Review, Invalid

  // Sorting
  const [sortField, setSortField] = useState<keyof Competitor | 'validation'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Interactive Active Records Selections
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk Actions Parameters
  const [bulkDistrict, setBulkDistrict] = useState<string>('');
  const [bulkGender, setBulkGender] = useState<string>('Unchanged');
  const [bulkDivision, setBulkDivision] = useState<string>('Unchanged');
  const [bulkCategory, setBulkCategory] = useState<string>('Unchanged');

  // Interactive Overlays Drawers / Modals State
  const [selectedAthleteIdForDrawer, setSelectedAthleteIdForDrawer] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [duplicateClusters, setDuplicateClusters] = useState<{key: string, records: Competitor[]}[]>([]);
  const [importSummary, setImportSummary] = useState<{
    show: boolean;
    imported: number;
    needsReview: number;
    missingGender: number;
    missingBodyWeight: number;
    missingCategory: number;
    missingFee: number;
  } | null>(null);

  // General Diagnostic Utilities State
  const [copySuccess, setCopySuccess] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Active Championship Category Selection Mock
  const [activeCompetition, setActiveCompetition] = useState('West Bengal State Powerlifting Championship 2026');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOCAL PERSISTENCE LOOPS ---
  useEffect(() => {
    try {
      const savedList = localStorage.getItem('wbspa_athlete_roster_v2_new');
      const savedFiles = localStorage.getItem('wbspa_uploaded_files_v2_new');
      
      let initialList: Competitor[] = [];
      if (savedList) {
        initialList = JSON.parse(savedList);
      } else {
        // Look for grandfathered list
        const oldSaved = localStorage.getItem('wbspa_athlete_roster_v2');
        if (oldSaved) {
          initialList = JSON.parse(oldSaved);
        }
      }

      if (initialList.length > 0) {
        // Retroactive fix for 'Missing' string values and status
        initialList = initialList.map(c => {
          let bw = String(c.bodyweight_category || '');
          if (bw.toLowerCase() === 'undefined' || bw.toLowerCase() === 'null' || bw.toLowerCase() === 'nan') bw = '';
          
          let dist = String(c.district || '');
          if (dist.toLowerCase() === 'undefined' || dist.toLowerCase() === 'null' || dist.toLowerCase() === 'nan') dist = '';
          
          let cat = String(c.category || '');
          if (cat.toLowerCase() === 'undefined' || cat.toLowerCase() === 'null' || cat.toLowerCase() === 'nan') cat = '';

          let gen = String(c.gender || '');
          if (gen.toLowerCase() === 'undefined' || gen.toLowerCase() === 'null' || gen.toLowerCase() === 'nan') gen = '';

          let div = String(c.division || '');
          if (div.toLowerCase() === 'undefined' || div.toLowerCase() === 'null' || div.toLowerCase() === 'nan') div = '';

          c.bodyweight_category = bw;
          c.district = dist;
          c.category = cat;
          c.gender = gen as any;
          c.division = div as any;
          
          // Re-evaluate importStatus
          if (!bw || !gen || (!cat && !div) || !dist) {
             c.importStatus = 'needs_review';
          } else {
             c.importStatus = 'complete';
          }
          return c;
        });
        setCompetitors(initialList);
      }

      if (savedFiles) {
        setUploadedFiles(JSON.parse(savedFiles));
      }
    } catch (e) {
      console.error('Failed to load storage assets', e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('wbspa_athlete_roster_v2_new', JSON.stringify(competitors));
  }, [competitors]);

  useEffect(() => {
    localStorage.setItem('wbspa_uploaded_files_v2_new', JSON.stringify(uploadedFiles));
  }, [uploadedFiles]);


  // --- CLIENT-SIDE PDF OCR FALLBACK ---
  const runLocalPdfOCR = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    
    let allCompetitors: any[] = [];
    
    const worker = await Tesseract.createWorker('eng', 1, {
      workerPath: tesseractWorkerUrl,
      corePath: '/tesseract',
      langPath: '/',
    });
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // @ts-ignore
      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;
      
      const imageDataUrl = canvas.toDataURL('image/png');
      
      const ret = await worker.recognize(imageDataUrl);
      const lines = ret.data.text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 3);
      
      const pageCompetitors = lines.map((line: string) => {
        let cleanName = line.replace(/^\W+/, '').substring(0, 100);
        return {
          district: "",
          name: cleanName || 'UNKNOWN',
          gender: "",
          bodyweight_category: "",
          division: "",
          category: "",
          entry_fee: 0,
          source_page: i
        };
      });
      
      allCompetitors = allCompetitors.concat(pageCompetitors);
    }
    
    await worker.terminate();
    
    return allCompetitors;
  };

  // --- PARSE FILE HANDLERS (EXCEPTIONAL ERROR CHECKING) ---
  const handleUploadFile = async (file: File) => {
    setAppError(null);
    const newFileState: UploadedFileState = {
      name: file.name,
      size: file.size,
      status: 'parsing'
    };

    setUploadedFiles((prev) => [newFileState, ...prev]);

    let incomingLifters: any[] = [];
    let isLocalFallback = false;

    try {
      if (!navigator.onLine && file.name.toLowerCase().endsWith('.pdf')) {
        console.warn("Offline detected. Running local PDF fallback OCR...");
        incomingLifters = await runLocalPdfOCR(file);
        isLocalFallback = true;
      } else {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const response = await fetch('/api/parse-competitors', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            let errText = 'Server error during parsing.';
            try {
              const errData = await response.json();
              errText = errData.error || errText;
            } catch (_) {}
            throw new Error(errText);
          }

          const rawResult = await response.json();
          if (!rawResult.success) {
            throw new Error(rawResult.error || 'Parsing failed.');
          }

          incomingLifters = rawResult.competitors || [];
        } catch (fetchErr: any) {
          if (file.name.toLowerCase().endsWith('.pdf')) {
            console.warn("Fetch failed, running local PDF fallback OCR...", fetchErr);
            incomingLifters = await runLocalPdfOCR(file);
            isLocalFallback = true;
          } else {
            throw fetchErr;
          }
        }
      }

      let missingGender = 0;
      let missingBodyWeight = 0;
      let missingCategory = 0;
      let missingFee = 0;
      let needsReviewCount = 0;

      const transformedLifters: Competitor[] = incomingLifters.map((lifter, index) => {
        const rawDistrict = lifter.district ? lifter.district.trim() : null;
        
        // Exact correction lookup with our high fidelity fuzzy check
        const { matchedDistrict, confidence } = fuzzyMatchDistrict(rawDistrict);
        const resolvedAssoc = matchedDistrict ? (DISTRICT_ASSOCIATION_MAP[matchedDistrict] || null) : null;

        const isMissingGender = !lifter.gender;
        const isMissingBodyWeight = !lifter.bodyweight_category;
        const isMissingCategory = !lifter.division && !lifter.category;
        const isMissingFee = !lifter.entry_fee || lifter.entry_fee === 0;

        if (isMissingGender) missingGender++;
        if (isMissingBodyWeight) missingBodyWeight++;
        if (isMissingCategory) missingCategory++;
        if (isMissingFee) missingFee++;

        const needsReview = isMissingGender || isMissingBodyWeight || isMissingCategory || !matchedDistrict;
        if (needsReview) needsReviewCount++;

        return {
          id: `parsed-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`,
          name: (lifter.name || '').toUpperCase(),
          gender: lifter.gender === 'Women' ? 'Women' : (lifter.gender === 'Men' ? 'Men' : ''),
          bodyweight_category: lifter.bodyweight_category ? String(lifter.bodyweight_category) : '',
          division: lifter.division || '',
          category: lifter.category || lifter.division || '',
          entry_fee: lifter.entry_fee ? Number(lifter.entry_fee) : 0,
          source_page: lifter.source_page || 1,

          rawExtractedDistrict: rawDistrict || '',
          district: matchedDistrict || rawDistrict || '',
          districtAssociation: resolvedAssoc || '',
          districtConfidence: matchedDistrict ? 100 : confidence,
          districtConfirmed: matchedDistrict ? true : false,

          attempts_squat: '',
          attempts_bench: '',
          attempts_deadlift: '',
          phone_number: lifter.phone_number || '',
          notes: '',
          importStatus: needsReview ? 'needs_review' : 'complete'
        } as Competitor;
      });

      setCompetitors((prev) => [...transformedLifters, ...prev]);

      // Complete successfully
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? { 
                ...f, 
                status: needsReviewCount > 0 ? 'warning' : 'success', 
                count: transformedLifters.length,
                needsReviewCount,
                missingFields: {
                  gender: missingGender,
                  bodyWeight: missingBodyWeight,
                  category: missingCategory,
                  fee: missingFee
                }
              }
            : f
        )
      );

      setImportSummary({
        show: true,
        imported: transformedLifters.length,
        needsReview: needsReviewCount,
        missingGender,
        missingBodyWeight,
        missingCategory,
        missingFee
      });

    } catch (err: any) {
      console.error(err);
      setAppError(err.message || 'Error occurred while processing files.');
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? { ...f, status: 'error', errorMsg: err.message || 'Failure' }
            : f
        )
      );
    }
  };

  // --- DRAG AND DROP UTILITIES ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    files.forEach((file) => handleUploadFile(file));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      files.forEach((file) => handleUploadFile(file));
    }
  };


  // --- DUPLICATE COLLABORATORS MERGER ENGINE ---
  const mergeDuplicates = (silent = false) => {
    if (competitors.length === 0) return;

    const clustersMap: Record<string, Competitor[]> = {};
    competitors.forEach((c) => {
      // Comparison based on Name, Gender, Category
      const key = `${c.name.trim().toUpperCase()}|${c.gender}|${c.category}`;
      if (!clustersMap[key]) {
        clustersMap[key] = [];
      }
      clustersMap[key].push(c);
    });

    const activeClusters = Object.entries(clustersMap)
      .filter(([, records]) => records.length > 1)
      .map(([key, records]) => ({ key, records }));

    if (activeClusters.length > 0) {
      setDuplicateClusters(activeClusters);
    } else {
      if (!silent) alert('No duplicates found!');
    }
  };

  const handleDuplicateResolutionComplete = (resolvedRecords: Competitor[]) => {
    // Collect all records that were NOT part of any cluster (the singles)
    const clustersMap: Record<string, Competitor[]> = {};
    competitors.forEach((c) => {
      const key = `${c.name.trim().toUpperCase()}|${c.gender}|${c.category}`;
      if (!clustersMap[key]) {
        clustersMap[key] = [];
      }
      clustersMap[key].push(c);
    });

    const singlesList: Competitor[] = [];
    Object.values(clustersMap).forEach((cluster) => {
      if (cluster.length === 1) {
        singlesList.push(cluster[0]);
      }
    });

    // The new competitors list is the singles + the resolved records
    setCompetitors([...singlesList, ...resolvedRecords]);
    setSelectedIds(new Set());
    setDuplicateClusters([]);
  };


  // --- BULK CONTROLS MANAGER ---
  const handleBulkAssign = () => {
    if (selectedIds.size === 0) return;

    setCompetitors((prev) =>
      prev.map((c) => {
        if (!selectedIds.has(c.id)) return c;

        const updated = { ...c };
        if (bulkDistrict) {
          updated.district = bulkDistrict;
          updated.districtAssociation = DISTRICT_ASSOCIATION_MAP[bulkDistrict] || null;
          updated.districtConfidence = 100;
          updated.districtConfirmed = true;
        }
        if (bulkGender !== 'Unchanged') {
          updated.gender = bulkGender as 'Men' | 'Women';
          // Ensure wt classes correspond safely
          const allowed = updated.gender === 'Women' ? IPF_WOMEN_WEIGHTS : IPF_MEN_WEIGHTS;
          if (!allowed.includes(updated.bodyweight_category || '')) {
            updated.bodyweight_category = updated.gender === 'Women' ? '63' : '74';
          }
        }
        if (bulkDivision !== 'Unchanged') {
          updated.division = bulkDivision as any;
        }
        if (bulkCategory !== 'Unchanged') {
          updated.category = bulkCategory;
        }
        return updated;
      })
    );

    setSelectedIds(new Set());
    setBulkDistrict('');
    setBulkGender('Unchanged');
    setBulkDivision('Unchanged');
    setBulkCategory('Unchanged');
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} selected lifters inside this catalog?`)) {
      setCompetitors((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
    }
  };


  // --- INDIVIDUAL ROW INTERACTIONS ---
  const handleSaveEditedAthlete = (updatedAthlete: Competitor) => {
    setCompetitors((prev) =>
      prev.map((c) => (c.id === updatedAthlete.id ? updatedAthlete : c))
    );
    setSelectedAthleteIdForDrawer(null);
  };

  const handleDeleteAthlete = (id: string) => {
    if (confirm('Delete competitor profile row permanently?')) {
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      setSelectedAthleteIdForDrawer(null);
    }
  };


  // --- GROUPING AND CLASSIFICATION SYSTEM FOR IPF CATEGORY WISE LISTS ---
  const resolveDivisionString = (val: string): string => {
    const v = val.trim().toLowerCase();
    if (v === 'sj' || v === 'sub-junior' || v === 'sub junior') return 'Sub Junior';
    if (v === 'jr' || v === 'junior') return 'Junior';
    if (v === 'sr' || v === 'senior' || v === 'open' || v === 's') return 'Senior';
    if (v === 'm1' || v === 'master 1') return 'Master 1';
    if (v === 'm2' || v === 'master 2') return 'Master 2';
    if (v === 'm3' || v === 'master 3') return 'Master 3';
    if (v === 'm4' || v === 'master 4') return 'Master 4';
    return val.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  const getAthleteDivisions = (divisionInput: any): string[] => {
    if (!divisionInput) return ['Senior'];
    
    let rawStr = '';
    if (Array.isArray(divisionInput)) {
      return divisionInput.map(d => resolveDivisionString(String(d)));
    } else if (typeof divisionInput === 'string') {
      rawStr = divisionInput.trim();
      if (rawStr.startsWith('[') && rawStr.endsWith(']')) {
        try {
          const parsed = JSON.parse(rawStr);
          if (Array.isArray(parsed)) {
            return parsed.map(d => resolveDivisionString(String(d)));
          }
        } catch (_) {}
      }
    } else {
      rawStr = String(divisionInput);
    }

    const parts = rawStr.split(/[+,/]+/).map(p => p.trim()).filter(Boolean);
    const resolved = parts.map(p => resolveDivisionString(p));
    return Array.from(new Set(resolved));
  };

  const normalizeBodyweightCategory = (wt: string | null, gender: 'Men' | 'Women'): string => {
    if (!wt) return gender === 'Men' ? '74 kg' : '57 kg';
    let clean = wt.trim().toLowerCase().replace(/\s*kg\s*$/, '').trim();
    
    const menCategories = ["53", "59", "66", "74", "83", "93", "105", "120", "+120"];
    const womenCategories = ["43", "47", "52", "57", "63", "69", "76", "84", "+84"];
    
    const allowed = gender === 'Men' ? menCategories : womenCategories;
    
    if (allowed.includes(clean)) {
      return clean.includes('+') ? `${clean} kg` : `${clean} kg`;
    }
    if (clean.startsWith('+')) {
      const num = clean.replace('+', '').trim();
      if (allowed.includes('+' + num)) return `+${num} kg`;
    }
    
    const isPlus = clean.includes('+') || clean.startsWith('>');
    const match = clean.match(/(\d+)/);
    if (match) {
      const numStr = match[1];
      const key = (isPlus ? '+' : '') + numStr;
      if (allowed.includes(key)) {
        return `${key} kg`;
      }
      const bestMatch = allowed.find(cat => cat.replace(/[+]/g, '') === numStr);
      if (bestMatch) {
        return bestMatch.includes('+') ? `${bestMatch} kg` : `${bestMatch} kg`;
      }
      return `${key} kg`;
    }
    
    return `${clean} kg`;
  };

  const buildCategoryWiseData = (athletes: Competitor[]) => {
    const structure: any = {
      Men: {},
      Women: {}
    };

    const menCategories = ["53 kg", "59 kg", "66 kg", "74 kg", "83 kg", "93 kg", "105 kg", "120 kg", "+120 kg"];
    const womenCategories = ["43 kg", "47 kg", "52 kg", "57 kg", "63 kg", "69 kg", "76 kg", "84 kg", "+84 kg"];
    const allDivisions = ["Sub Junior", "Junior", "Senior", "Master 1", "Master 2", "Master 3", "Master 4"];

    menCategories.forEach(cat => {
      structure.Men[cat] = {};
      allDivisions.forEach(div => {
        structure.Men[cat][div] = [];
      });
    });

    womenCategories.forEach(cat => {
      structure.Women[cat] = {};
      allDivisions.forEach(div => {
        structure.Women[cat][div] = [];
      });
    });

    athletes.forEach(athlete => {
      const gender = athlete.gender === 'Women' ? 'Women' : 'Men';
      const rawCat = athlete.bodyweight_category || '';
      const normalizedCat = normalizeBodyweightCategory(rawCat, gender);
      
      if (!structure[gender][normalizedCat]) {
        structure[gender][normalizedCat] = {};
        allDivisions.forEach(div => {
          structure[gender][normalizedCat][div] = [];
        });
      }

      const divisions = getAthleteDivisions(athlete.division);
      divisions.forEach(div => {
        if (!structure[gender][normalizedCat][div]) {
          structure[gender][normalizedCat][div] = [];
        }
        structure[gender][normalizedCat][div].push({
          name: (athlete.name || '').trim().toUpperCase(),
          district: (athlete.district || 'Unassigned').trim()
        });
      });
    });

    const sortByName = (a: any, b: any) => {
      return a.name.localeCompare(b.name);
    };

    Object.keys(structure).forEach(gKey => {
      Object.keys(structure[gKey]).forEach(cKey => {
        Object.keys(structure[gKey][cKey]).forEach(dKey => {
          structure[gKey][cKey][dKey].sort(sortByName);
        });
      });
    });

    return { structure, menCategories, womenCategories, allDivisions };
  };

  const exportCategoryWiseJSON = () => {
    if (competitors.length === 0) return;
    const { structure } = buildCategoryWiseData(competitors);
    const cleanExport: any = {};
    
    ['Men', 'Women'].forEach(gender => {
      const genderData = structure[gender];
      const catKeys = Object.keys(genderData);
      
      catKeys.forEach(cat => {
        const catData = genderData[cat];
        const divKeys = Object.keys(catData);
        
        const filteredCatData: any = {};
        divKeys.forEach(div => {
          const athletes = catData[div];
          if (athletes && athletes.length > 0) {
            filteredCatData[div] = athletes;
          }
        });
        
        if (Object.keys(filteredCatData).length > 0) {
          if (!cleanExport[gender]) {
            cleanExport[gender] = {};
          }
          cleanExport[gender][cat] = filteredCatData;
        }
      });
    });

    const jsonStr = JSON.stringify(cleanExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanCompName = activeCompetition
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .join('');
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `WBSPA_Category_Wise_List_${cleanCompName}_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCategoryWisePDF = () => {
    if (competitors.length === 0) return;
    setIsPdfGenerating(true);

    setTimeout(() => {
      try {
        const doc = new jsPDF({
          orientation: 'l',
          unit: 'mm',
          format: 'a4'
        });

        const { structure, menCategories, womenCategories, allDivisions } = buildCategoryWiseData(competitors);

        const generatedOn = new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        doc.setTextColor(11, 16, 32);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('WEST BENGAL STATE POWERLIFTING CHAMPIONSHIP', 15, 16);

        doc.setFillColor(11, 16, 32);
        doc.rect(15, 19, 267, 1.2, 'F');

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);

        doc.setFont('Helvetica', 'bold');
        doc.text('Competition: ', 15, 26);
        doc.setFont('Helvetica', 'normal');
        doc.text(activeCompetition, 45, 26);

        doc.setFont('Helvetica', 'bold');
        doc.text('Total Athletes: ', 15, 31);
        doc.setFont('Helvetica', 'normal');
        doc.text(String(competitors.length), 42, 31);

        doc.setFont('Helvetica', 'bold');
        doc.text('Generated On: ', 15, 36);
        doc.setFont('Helvetica', 'normal');
        doc.text(generatedOn, 42, 36);

        let y = 44;

        const activeCategories: { gender: 'Men' | 'Women', category: string }[] = [];
        
        menCategories.forEach(cat => {
          let hasAthles = false;
          allDivisions.forEach(div => {
            if (structure.Men[cat][div].length > 0) hasAthles = true;
          });
          if (hasAthles) {
            activeCategories.push({ gender: 'Men', category: cat });
          }
        });

        womenCategories.forEach(cat => {
          let hasAthles = false;
          allDivisions.forEach(div => {
            if (structure.Women[cat][div].length > 0) hasAthles = true;
          });
          if (hasAthles) {
            activeCategories.push({ gender: 'Women', category: cat });
          }
        });

        if (activeCategories.length === 0) {
          doc.setFont('Helvetica', 'italic');
          doc.setFontSize(11);
          doc.text('No competitor registration found in current database.', 15, 50);
        } else {
          activeCategories.forEach((act) => {
            const genderTerm = act.gender.toUpperCase();
            const categoryTerm = act.category.toUpperCase();
            const titleText = `${genderTerm} ${categoryTerm}`;
            
            if (y + 35 > 190) {
              doc.addPage();
              y = 15;
            }

            doc.setFillColor(11, 16, 32); 
            doc.rect(15, y, 267, 8, 'F');
            doc.setFillColor(0, 229, 255); 
            doc.rect(15, y + 8, 267, 0.6, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(titleText, 18, y + 5.5);

            y += 12;

            allDivisions.forEach(div => {
              const list = structure[act.gender][act.category][div];
              if (list.length === 0) return;

              const neededHeight = 5 + (list.length * 5.2) + 3;
              
              if (y + neededHeight > 190) {
                doc.addPage();
                y = 15;
                
                doc.setFillColor(11, 16, 32); 
                doc.rect(15, y, 267, 8, 'F');
                doc.setFillColor(0, 229, 255); 
                doc.rect(15, y + 8, 267, 0.6, 'F');

                doc.setTextColor(255, 255, 255);
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(10);
                doc.text(`${titleText} (Continued)`, 18, y + 5.5);

                y += 12;
              }

              doc.setTextColor(123, 97, 255); 
              doc.setFont('Helvetica', 'bold');
              doc.setFontSize(9);
              doc.text(div, 18, y);
              y += 4.5;

              doc.setFont('Helvetica', 'normal');
              doc.setFontSize(8.5);
              doc.setTextColor(15, 23, 42);
              list.forEach((athlete: any, aIdx: number) => {
                doc.text(`${aIdx + 1}. ${athlete.name} – ${athlete.district}`, 21, y);
                y += 5.2;
              });
              
              y += 2.5; 
            });

            y += 5; 
          });
        }

        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);

          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(15, 198, 282, 198);

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);

          doc.text('WEST BENGAL STATE POWERLIFTING ASSOCIATION — CATEGORY MEMBERSHIP', 15, 203);

          const pageStr = `Page ${i} of ${totalPages}`;
          doc.text(pageStr, 282 - doc.getTextWidth(pageStr), 203);
        }

        const cleanCompName = activeCompetition
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .split(/\s+/)
          .join('');
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `WBSPA_Category_Wise_List_${cleanCompName}_${dateStr}.pdf`;

        doc.save(filename);
      } catch (error) {
        console.error("PDF transmittal generation failed", error);
      } finally {
        setIsPdfGenerating(false);
      }
    }, 150);
  };


  // --- EXPORT DOWNLOAD HANDLERS ---
  const downloadJSON = () => {
    if (competitors.length === 0) return;
    const payload = competitors.map((c) => ({
      district: c.district || '',
      name: c.name || '',
      gender: c.gender || '',
      weight_class: c.bodyweight_category || '',
      division: c.division || ''
    }));

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wbspa_standardized_athletes_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyJSONToClipboard = () => {
    if (competitors.length === 0) return;
    const payload = competitors.map((c) => ({
      district: c.district || '',
      name: c.name || '',
      gender: c.gender || '',
      weight_class: c.bodyweight_category || '',
      division: c.division || ''
    }));

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const downloadCSV = () => {
    if (competitors.length === 0) return;
    const headers = ['Athlete Name', 'District', 'District Association', 'Gender', 'Wt class', 'Division', 'Category', 'Entry Fee (INR)', 'Attempts Squat', 'Attempts Bench', 'Attempts Deadlift', 'Phone'];
    const rows = competitors.map((c) => [
      c.name,
      c.district || '',
      c.districtAssociation || '',
      c.gender,
      c.bodyweight_category || '',
      c.division || '',
      c.category || '',
      c.entry_fee || '',
      c.attempts_squat || '',
      c.attempts_bench || '',
      c.attempts_deadlift || '',
      c.phone_number || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wbspa_exported_roster_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadXLSX = () => {
    if (competitors.length === 0) return;
    const sheetData = competitors.map((c) => ({
      'Athlete Name': c.name,
      'District': c.district || '',
      'District Association': c.districtAssociation || '',
      'Gender': c.gender,
      'Wt Class': c.bodyweight_category ? `${c.bodyweight_category} kg` : '-',
      'Age Division': c.division || '-',
      'Championship Category': c.category || '-',
      'Entry Fee (INR)': c.entry_fee || 0,
      'Squat Attempts': c.attempts_squat || '',
      'Bench Attempts': c.attempts_bench || '',
      'Deadlift Attempts': c.attempts_deadlift || '',
      'Phone Number': c.phone_number || '',
      'Notes': c.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Roster Registries');
    XLSX.writeFile(workbook, `wbspa_lifters_${Date.now()}.xlsx`);
  };

  const downloadPDFPrinter = () => {
    if (competitors.length === 0) return;
    setIsPdfGenerating(true);

    setTimeout(() => {
      try {
        const doc = new jsPDF({
          orientation: 'l',
          unit: 'mm',
          format: 'a4'
        });

        // 1. Sort competitors: District -> Bodyweight Category -> Division -> Name
        const sortedAthletes = [...competitors].sort((a, b) => {
          // A. District
          const districtA = (a.district || '').trim().toLowerCase();
          const districtB = (b.district || '').trim().toLowerCase();
          if (districtA !== districtB) {
            if (!districtA) return 1;
            if (!districtB) return -1;
            return districtA.localeCompare(districtB);
          }

          // B. Bodyweight Category
          const getWeightSortValue = (wt: string | null): number => {
            if (!wt) return 999999;
            const match = wt.match(/(\d+)/);
            const numericPart = match ? parseFloat(match[1]) : 0;
            const isPlus = wt.includes('+');
            return numericPart + (isPlus ? 0.1 : 0);
          };
          const wtA = getWeightSortValue(a.bodyweight_category);
          const wtB = getWeightSortValue(b.bodyweight_category);
          if (wtA !== wtB) return wtA - wtB;

          // C. Division
          const getDivisionSortRank = (div: any): number => {
            if (!div) return 999999;
            let resolvedDivStr = '';
            if (Array.isArray(div)) {
              resolvedDivStr = div[0] || '';
            } else if (typeof div === 'string') {
              const trimmed = div.trim();
              if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                  const parsed = JSON.parse(trimmed);
                  if (Array.isArray(parsed)) {
                    resolvedDivStr = parsed[0] || '';
                  }
                } catch (_) {}
              }
              if (!resolvedDivStr) {
                resolvedDivStr = trimmed.split(/[+,/]+/)[0] || trimmed;
              }
            }
            const dLower = resolvedDivStr.trim().toLowerCase();
            if (dLower === 'sj' || dLower === 'sub-junior' || dLower === 'sub junior') return 1;
            if (dLower === 'jr' || dLower === 'junior') return 2;
            if (dLower === 'sr' || dLower === 'senior' || dLower === 'open') return 3;
            if (dLower === 'm1' || dLower === 'master 1') return 4;
            if (dLower === 'm2' || dLower === 'master 2') return 5;
            if (dLower === 'm3' || dLower === 'master 3') return 6;
            if (dLower === 'm4' || dLower === 'master 4') return 7;
            return 100;
          };
          const divA = getDivisionSortRank(a.division);
          const divB = getDivisionSortRank(b.division);
          if (divA !== divB) return divA - divB;

          // D. Name
          const nameA = (a.name || '').trim().toLowerCase();
          const nameB = (b.name || '').trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });

        // Helpers
        const formatBodyweight = (wt: string | null): string => {
          if (!wt) return '-';
          const trimmed = wt.trim();
          if (trimmed.toLowerCase().endsWith('kg')) return trimmed;
          return `${trimmed} kg`;
        };

        const resolveSingleDivisionName = (val: string): string => {
          const v = val.trim().toLowerCase();
          if (v === 'sj' || v === 'sub junior' || v === 'sub-junior') return 'Sub Junior';
          if (v === 'jr' || v === 'junior') return 'Junior';
          if (v === 'sr' || v === 'senior') return 'Senior';
          if (v === 'm1' || v === 'master 1') return 'Master 1';
          if (v === 'm2' || v === 'master 2') return 'Master 2';
          if (v === 'm3' || v === 'master 3') return 'Master 3';
          if (v === 'm4' || v === 'master 4') return 'Master 4';
          if (v === 'open') return 'Senior';
          return val.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        };

        const formatDivision = (div: any): string => {
          if (!div) return '-';
          if (Array.isArray(div)) {
            return div.map(d => resolveSingleDivisionName(d)).join(', ');
          }
          if (typeof div === 'string') {
            const trimmed = div.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                  return parsed.map(d => resolveSingleDivisionName(d)).join(', ');
                }
              } catch (_) {}
            }
            if (trimmed.includes('+') || trimmed.includes(',') || trimmed.includes('/')) {
              const parts = trimmed.split(/[+,/]+/).map(p => p.trim()).filter(Boolean);
              return parts.map(d => resolveSingleDivisionName(d)).join(', ');
            }
            return resolveSingleDivisionName(trimmed);
          }
          return '-';
        };

        const drawTableHeader = (docInstance: typeof doc, currentY: number) => {
          docInstance.setFillColor(11, 16, 32); 
          docInstance.rect(15, currentY, 267, 9, 'F');

          docInstance.setFillColor(0, 229, 255);
          docInstance.rect(15, currentY + 9, 267, 0.8, 'F');

          docInstance.setTextColor(255, 255, 255);
          docInstance.setFont('Helvetica', 'bold');
          docInstance.setFontSize(9);
          
          docInstance.text('Sl No', 17, currentY + 6);
          docInstance.text('District', 32, currentY + 6);
          docInstance.text('Name', 97, currentY + 6);
          docInstance.text('Bodyweight Category', 192, currentY + 6);
          docInstance.text('Division', 234, currentY + 6);
        };

        const generatedOn = new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        // Page 1 Header Info block
        doc.setTextColor(11, 16, 32);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('WEST BENGAL STATE POWERLIFTING CHAMPIONSHIP', 15, 16);

        // Styling divider bar
        doc.setFillColor(11, 16, 32);
        doc.rect(15, 19, 267, 1.2, 'F');

        // Subheader Details rows
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);

        doc.setFont('Helvetica', 'bold');
        doc.text('Competition Name: ', 15, 26);
        doc.setFont('Helvetica', 'normal');
        doc.text(activeCompetition, 49, 26);

        doc.setFont('Helvetica', 'bold');
        doc.text('Total Athletes: ', 15, 31);
        doc.setFont('Helvetica', 'normal');
        doc.text(String(sortedAthletes.length), 40, 31);

        doc.setFont('Helvetica', 'bold');
        doc.text('Generated On: ', 15, 36);
        doc.setFont('Helvetica', 'normal');
        doc.text(generatedOn, 40, 36);

        let y = 42;
        drawTableHeader(doc, y);
        y += 9.8; 

        // Draw Athletes rows
        sortedAthletes.forEach((athlete, index) => {
          const slNo = String(index + 1);
          const district = athlete.district || '-';
          const name = athlete.name.toUpperCase();
          const bodyweight = formatBodyweight(athlete.bodyweight_category);
          const division = formatDivision(athlete.division);

          if (y + 8 > 190) {
            doc.addPage();
            y = 15;
            drawTableHeader(doc, y);
            y += 9.8;
          }

          if (index % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, y, 267, 8, 'F');
          }

          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.1);
          doc.line(15, y + 8, 282, y + 8);

          doc.setTextColor(15, 23, 42); 
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8.5);

          doc.text(slNo, 17, y + 5.5);
          doc.text(district, 32, y + 5.5);
          
          doc.setFont('Helvetica', 'bold');
          doc.text(name, 97, y + 5.5);
          
          doc.setFont('Helvetica', 'normal');
          doc.text(bodyweight, 192, y + 5.5);
          doc.text(division, 234, y + 5.5);

          y += 8;
        });

        // Footer markings
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);

          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(15, 198, 282, 198);

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);

          doc.text('WEST BENGAL STATE POWERLIFTING ASSOCIATION — OFFICIAL ENTRY LIST', 15, 203);

          const pageStr = `Page ${i} of ${totalPages}`;
          doc.text(pageStr, 282 - doc.getTextWidth(pageStr), 203);
        }

        const cleanCompName = activeCompetition
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .split(/\s+/)
          .join('');
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `WBSPA_${cleanCompName}_${dateStr}.pdf`;

        doc.save(filename);
      } catch (error) {
        console.error("PDF transmittal generation failed", error);
      } finally {
        setIsPdfGenerating(false);
      }
    }, 150);
  };


  // --- SECTIONS CALCULATIONS & MEMOIZED LISTS ---
  const duplicateNames = useMemo(() => {
    const registry: Record<string, number> = {};
    competitors.forEach((c) => {
      const uName = c.name.trim().toUpperCase();
      if (uName) {
        registry[uName] = (registry[uName] || 0) + 1;
      }
    });

    const multiples = new Set<string>();
    Object.entries(registry).forEach(([name, count]) => {
      if (count > 1) multiples.add(name);
    });
    return multiples;
  }, [competitors]);

  const activeDistrictsList = useMemo(() => {
    const list = new Set<string>();
    competitors.forEach((c) => {
      if (c.district) list.add(c.district);
    });
    return Array.from(list).sort();
  }, [competitors]);

  const processedList = useMemo(() => {
    return competitors.filter((c) => {
      const matchSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.district && c.district.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchGender = filterGender === 'All' || c.gender === filterGender;
      const matchDivision = filterDivision === 'All' || c.division === filterDivision;
      const matchDistrict = filterDistrict === 'All' || c.district === filterDistrict;

      const vState = getValidationState(c);
      const matchValidation = filterValidation === 'All' || vState === filterValidation.toLowerCase();

      return matchSearch && matchGender && matchDivision && matchDistrict && matchValidation;
    });
  }, [competitors, searchTerm, filterGender, filterDivision, filterDistrict, filterValidation]);

  const sortedProcessedList = useMemo(() => {
    const list = [...processedList];
    list.sort((a, b) => {
      let valA: any = sortField === 'validation' ? getValidationState(a) : a[sortField];
      let valB: any = sortField === 'validation' ? getValidationState(b) : b[sortField];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortDirection === 'asc' 
          ? (valA > valB ? 1 : -1) 
          : (valA < valB ? 1 : -1);
      }
    });
    return list;
  }, [processedList, sortField, sortDirection]);

  // Comprehensive Metrics Dashboard
  const summaryKPIs = useMemo(() => {
    let males = 0;
    let females = 0;
    let reviews = 0;
    let fees = 0;
    const uniqueness = new Set<string>();

    competitors.forEach((c) => {
      if (c.gender === 'Women') females++;
      else males++;

      const validation = getValidationState(c);
      if (validation === 'needs_review') reviews++;
      fees += c.entry_fee || 0;

      if (c.district) uniqueness.add(c.district);
    });

    const parsedCount = uploadedFiles.filter(f => f.status === 'success').length;

    return {
      total: competitors.length,
      males,
      females,
      districts: uniqueness.size,
      reviews,
      fees,
      parsedCount
    };
  }, [competitors, uploadedFiles]);


  // Selection Toggle Helpers
  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelection = (currentList: Competitor[]) => {
    const allSelected = currentList.every((c) => selectedIds.has(c.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        currentList.forEach((c) => next.delete(c.id));
      } else {
        currentList.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const selectedAthleteForDrawer = useMemo(() => {
    return competitors.find((c) => c.id === selectedAthleteIdForDrawer) || null;
  }, [competitors, selectedAthleteIdForDrawer]);

  const calculatedJSONSizeKB = useMemo(() => {
    const str = JSON.stringify(competitors);
    return (str.length / 1024).toFixed(1);
  }, [competitors]);

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#E2E8F0] font-sans antialiased flex flex-col selection:bg-[#00E5FF]/20 selection:text-white pb-12">
      
      {/* =====================================================
          SECTION 1: TOP NAVIGATION BAR
          ===================================================== */}
      <nav className="h-16 border-b border-white/[0.08] flex items-center justify-between px-6 md:px-12 bg-[#0B1020]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-[#00E5FF] to-[#7B61FF] rounded-xl flex items-center justify-center text-black font-extrabold italic shadow-md shadow-[#00E5FF]/20">
            W
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-black tracking-wider text-white uppercase flex items-center gap-1.5 leading-none">
              WBSPA Competitor Matrix
              <span className="text-[8px] bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-widest leading-none">
                PRO EDITION
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono mt-1 leading-none uppercase">
              IPF Standardized sheets converter & telemetry dashboard
            </p>
          </div>
        </div>

        {/* Selection Changer Mock */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#121A2B] border border-white/5 rounded-xl text-xs font-mono">
          <Calendar className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
          <select 
            value={activeCompetition}
            onChange={(e) => setActiveCompetition(e.target.value)}
            className="bg-transparent text-white focus:outline-none focus:ring-0 max-w-[320px] truncate"
          >
            <option value="West Bengal State Powerlifting Championship 2026">West Bengal State Powerlifting Championship 2026</option>
            <option value="National Under-23 Classic Selection Trials 2026">National Under-23 Classic Selection Trials 2026</option>
            <option value="District Classic Deadlift & Bench Championship">District Classic Deadlift & Bench Championship</option>
          </select>
        </div>

        <div className="flex items-center gap-3.5">
          {/* NEW COMPACT EXPORTS DROPDOWN */}
          <div className="relative">
            <button
              id="btn_export_options_trigger"
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#00E5FF]/20 bg-[#00E5FF]/5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-[#00E5FF] hover:bg-[#00E5FF]/15 transition-all cursor-pointer shadow-sm shadow-[#00E5FF]/5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#00E5FF]" />
              Export Options
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown panel */}
            <AnimatePresence>
              {isExportDropdownOpen && (
                <>
                  {/* Backdrop overlay for click-away behavior */}
                  <div 
                    className="fixed inset-0 z-40 bg-black/10" 
                    onClick={() => setIsExportDropdownOpen(false)} 
                  />
                  <div
                    id="export_dropdown_menu"
                    className="absolute right-0 mt-2 w-64 bg-[#121A2B] border border-white/[0.08] rounded-xl shadow-2xl p-2 z-50 divide-y divide-white/5 space-y-1 block"
                  >
                    {/* Section 1: Standard Formats */}
                    <div className="py-1 space-y-0.5">
                      <p className="text-[8px] font-mono font-bold text-slate-500 uppercase px-2.5 mb-1">Standard Exports</p>
                      
                      <button
                        onClick={() => {
                          copyJSONToClipboard();
                          setIsExportDropdownOpen(false);
                        }}
                        disabled={competitors.length === 0}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-lg text-xs hover:bg-white/5 font-mono text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                        <div className="flex-1">
                          <span className="font-bold text-white block">Copy JSON</span>
                          <span className="text-[8px] text-slate-400 block mt-0.5 leading-none">To Clipboard</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          downloadJSON();
                          setIsExportDropdownOpen(false);
                        }}
                        disabled={competitors.length === 0}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-lg text-xs hover:bg-white/5 font-mono text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                        <div className="flex-1">
                          <span className="font-bold text-white block">Download JSON</span>
                          <span className="text-[8px] text-slate-400 block mt-0.5 leading-none">Structured File</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          downloadCSV();
                          setIsExportDropdownOpen(false);
                        }}
                        disabled={competitors.length === 0}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-lg text-xs hover:bg-white/5 font-mono text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#7B61FF] shrink-0" />
                        <div className="flex-1">
                          <span className="font-bold text-white block">Export CSV</span>
                          <span className="text-[8px] text-slate-400 block mt-0.5 leading-none">Spreadsheet Tables</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          downloadXLSX();
                          setIsExportDropdownOpen(false);
                        }}
                        disabled={competitors.length === 0}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-lg text-xs hover:bg-white/5 font-mono text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#00D084] shrink-0" />
                        <div className="flex-1">
                          <span className="font-bold text-white block">Export XLSX</span>
                          <span className="text-[8px] text-slate-400 block mt-0.5 leading-none">Excel Workbook</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          downloadPDFPrinter();
                          setIsExportDropdownOpen(false);
                        }}
                        disabled={competitors.length === 0 || isPdfGenerating}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-lg text-xs hover:bg-white/5 font-mono text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#FF5D73] shrink-0" />
                        <div className="flex-1">
                          <span className="font-bold text-white block">Download PDF</span>
                          <span className="text-[8px] text-slate-400 block mt-0.5 leading-none">Printable Transmittal</span>
                        </div>
                      </button>
                    </div>

                    {/* Section 2: IPF Groupings */}
                    <div className="py-1 pt-2 space-y-0.5">
                      <p className="text-[8px] font-mono font-bold text-slate-500 uppercase px-2.5 mb-1">Grouped Divisions</p>

                      <button
                        onClick={() => {
                          downloadCategoryWisePDF();
                          setIsExportDropdownOpen(false);
                        }}
                        disabled={competitors.length === 0 || isPdfGenerating}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-lg text-xs hover:bg-white/5 font-mono text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#FF5D73] shrink-0" />
                        <div className="flex-1">
                          <span className="font-bold text-white block">Category PDF</span>
                          <span className="text-[8px] text-slate-400 block mt-0.5 leading-none">Official IPF Category Roster</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          exportCategoryWiseJSON();
                          setIsExportDropdownOpen(false);
                        }}
                        disabled={competitors.length === 0}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left rounded-lg text-xs hover:bg-white/5 font-mono text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#00D084] shrink-0" />
                        <div className="flex-1">
                          <span className="font-bold text-white block">Category JSON</span>
                          <span className="text-[8px] text-slate-400 block mt-0.5 leading-none">Grouped Division Payload</span>
                        </div>
                      </button>
                    </div>
                    
                    {/* Metadata summary */}
                    <div className="px-2.5 py-1 rounded bg-black/20 text-[8px] text-slate-500 font-mono uppercase flex items-center justify-between">
                      <span>Index Size: {calculatedJSONSizeKB} KB</span>
                      <span className="text-[#00E5FF]">{summaryKPIs.total} Lifters</span>
                    </div>
                  </div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => {
              if (confirm('Verify: Purge entire lifter board? All current state variables will be permanently reset.')) {
                setCompetitors([]);
                setUploadedFiles([]);
                setAppError(null);
              }
            }}
            id="btn_clear_all"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/5 bg-white/[0.02] rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:border-[#FF5D73]/30 hover:text-[#FF5D73] hover:bg-[#FF5D73]/5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Reset State
          </button>
          
          <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#00D084]/5 border border-[#00D084]/25 text-[#00D084] font-mono text-[9px] font-extrabold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-[#00D084] rounded-full animate-pulse mr-0.5"></span>
            SYS: STABLE
          </div>
        </div>
      </nav>

      {/* Main Container Workspace */}
      <main className="max-w-7xl w-full mx-auto px-4 py-4 space-y-4 flex-1">
        
        {/* Error Callout Overlay banner */}
        {appError && (
          <div className="flex items-start gap-4 bg-[#FF5D73]/5 border border-[#FF5D73]/20 rounded-2xl p-4 text-xs text-red-200 animate-pulse">
            <AlertCircle className="w-5 h-5 text-[#FF5D73] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-white uppercase tracking-wider text-xs block">OCR Process Incident</span>
              <p className="text-red-305/80">{appError}</p>
            </div>
          </div>
        )}



        {/* =====================================================
            SECTION 2: SUMMARY CARDS
            ===================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          
          {competitors.length > 0 && (
            <>
              {/* Card 1: Total Athletes */}
              <div className="bg-[#121A2B] border border-white/[0.08] p-3 rounded-xl relative overflow-hidden group hover:border-[#00E5FF]/20 hover:scale-[1.01] transition-all duration-200">
                <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest font-semibold">Total Athletes</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-white font-mono leading-none">{summaryKPIs.total}</span>
                  <span className="text-[8px] text-[#00D084] font-mono font-bold flex items-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" />
                    Live
                  </span>
                </div>
              </div>

              {/* Card 2: Males */}
              <div className="bg-[#121A2B] border border-white/[0.08] p-3 rounded-xl relative overflow-hidden group hover:border-[#00E5FF]/20 hover:scale-[1.01] transition-all duration-200">
                <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest font-semibold">Male Category</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-[#00E5FF] font-mono leading-none">{summaryKPIs.males}</span>
                  <span className="text-[8px] text-slate-450 font-mono">
                    {summaryKPIs.total > 0 ? ((summaryKPIs.males / summaryKPIs.total) * 100).toFixed(0) : 0}% ratio
                  </span>
                </div>
              </div>

              {/* Card 3: Females */}
              <div className="bg-[#121A2B] border border-white/[0.08] p-3 rounded-xl relative overflow-hidden group hover:border-[#7B61FF]/20 hover:scale-[1.01] transition-all duration-200">
                <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest font-semibold">Female Category</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-[#7B61FF] font-mono leading-none">{summaryKPIs.females}</span>
                  <span className="text-[8px] text-slate-450 font-mono">
                    {summaryKPIs.total > 0 ? ((summaryKPIs.females / summaryKPIs.total) * 100).toFixed(0) : 0}% ratio
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Card 4: Districts */}
          <div className="bg-[#121A2B] border border-white/[0.08] p-3 rounded-xl relative overflow-hidden group hover:border-[#00D084]/20 hover:scale-[1.01] transition-all duration-200">
            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest font-semibold">State Districts</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-white font-mono leading-none">{summaryKPIs.districts}</span>
              <span className="text-[8px] text-[#00D084] font-mono font-bold">active</span>
            </div>
          </div>

          {/* Card 5: Pending Review */}
          <div className="bg-[#121A2B] border border-white/[0.08] p-3 rounded-xl relative overflow-hidden group hover:border-[#FFB547]/20 hover:scale-[1.01] transition-all duration-200">
            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest font-semibold">Pending Review</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-xl font-black font-mono leading-none ${summaryKPIs.reviews > 0 ? 'text-[#FFB547]' : 'text-[#00D084]'}`}>
                {summaryKPIs.reviews}
              </span>
              {summaryKPIs.reviews > 0 && (
                <span className="w-1.5 h-1.5 bg-[#FFB547] rounded-full animate-ping"></span>
              )}
            </div>
          </div>

          {/* Card 6: Total Entry Fees */}
          <div className="bg-[#121A2B] border border-white/[0.08] p-3 rounded-xl relative overflow-hidden group hover:border-[#00D084]/20 hover:scale-[1.01] transition-all duration-200">
            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest font-semibold">Fees Capital</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-[#00D084] font-mono leading-none">₹{summaryKPIs.fees}</span>
            </div>
          </div>

        </div>

        {/* =====================================================
            SECTION 3: FILE UPLOAD AND PARSING QUEUE
            ==================================================== */}
        <div className="bg-[#121A2B] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#00E5FF] font-mono flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-[#00E5FF]" />
            Uploads
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className={uploadedFiles.length > 0 ? "lg:col-span-7" : "lg:col-span-12"}>
              {/* Drag and Drop Zone */}
              <div 
                id="file_drop_zone"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border border-dashed rounded-xl p-8 text-center transition-all cursor-pointer select-none group bg-gradient-to-b from-[#121A2B]/60 to-[#0B1020]/80 h-full flex flex-col justify-center items-center ${
                  isDragging 
                    ? 'border-[#00E5FF] bg-[#00E5FF]/5 scale-[1.01]' 
                    : 'border-white/10 hover:border-[#00E5FF]/30 hover:shadow-[0_0_20px_rgba(0,229,255,0.05)]'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#00E5FF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.xlsx,.xls,.csv,.ods,.docx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                
                <div className="w-12 h-12 rounded-xl bg-[#00E5FF]/10 flex items-center justify-center text-[#00E5FF] mb-4 border border-[#00E5FF]/20">
                  <Upload className="w-6 h-6" />
                </div>

                <h4 className="font-bold text-white text-xs mb-1 font-mono uppercase tracking-wide">
                  Ingest Roster streams
                </h4>
                <p className="text-[10px] text-slate-400 max-w-[280px] mx-auto leading-relaxed font-mono">
                  Upload PDF, CSV, Excel, Word or visual screenshots
                </p>

                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/5 text-[8px] uppercase tracking-wider text-slate-400 bg-black/40 font-mono">
                  <span className="w-1.5 h-1.5 bg-[#00E5FF] rounded-full animate-pulse mr-0.5"></span>
                  <span>OCR Model: </span>
                  <span className="text-[#00E5FF] font-bold">GEMINI FLASH MULTI-MODAL</span>
                </div>
              </div>
            </div>

            {/* Upload Streams Queue monitor */}
            {uploadedFiles.length > 0 && (
              <div className="lg:col-span-5 bg-[#0B1020]/60 border border-white/5 rounded-xl p-4 flex flex-col justify-between">
                <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#00E5FF] flex items-center justify-between font-mono pb-2 border-b border-white/5">
                  <span>TIMELINE QUEUE ({uploadedFiles.length})</span>
                  <FileText className="w-3.5 h-3.5 text-[#00E5FF]" />
                </h4>

                <div className="space-y-2 mt-3 max-h-48 overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {uploadedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className={`flex items-center justify-between p-2.5 rounded-xl border bg-black/30 text-[11px] font-mono ${
                          file.status === 'success' 
                            ? 'border-[#00D084]/20 text-slate-350'
                            : file.status === 'error'
                            ? 'border-[#FF5D73]/20 text-slate-350'
                            : file.status === 'warning'
                            ? 'border-[#FFB547]/20 text-slate-350'
                            : 'border-white/20 text-slate-350'
                        }`}
                      >
                        <div className="min-w-0 max-w-[65%]">
                          <p className="font-bold text-white truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-slate-500 text-[9px] tracking-wider mt-0.5 font-mono">
                            {(file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <div className="text-right">
                          {file.status === 'parsing' && (
                            <span className="inline-flex items-center gap-1 text-[#FFB547] bg-[#FFB547]/5 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider border border-[#FFB547]/15 animate-pulse">
                              OCR Active
                            </span>
                          )}
                          {file.status === 'success' && (
                            <span className="inline-flex items-center gap-1 text-[#00D084] bg-[#00D084]/5 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider border border-[#00D084]/15">
                              +{file.count} lifters
                            </span>
                          )}
                          {file.status === 'warning' && (
                            <div className="flex flex-col items-end group relative">
                              <span className="inline-flex items-center gap-1 text-[#FFB547] bg-[#FFB547]/5 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider border border-[#FFB547]/15 cursor-help">
                                ⚠ {file.needsReviewCount} Needs Review
                              </span>
                              <div className="hidden group-hover:block absolute top-[100%] right-0 mt-1 z-10 w-48 bg-[#0B1020] border border-white/10 rounded overflow-hidden p-2 shadow-xl shadow-black/50">
                                <p className="text-[9px] font-bold text-white border-b border-white/10 pb-1 mb-1">Imported with Warnings</p>
                                <p className="text-[8px] text-slate-400">Total Extracted: {file.count}</p>
                                <p className="text-[8px] text-slate-400 mt-1 font-bold">Missing Data:</p>
                                <ul className="text-[8px] text-[#FFB547] mt-0.5 space-y-0.5">
                                  {file.missingFields?.gender ? <li>• Gender: {file.missingFields.gender}</li> : null}
                                  {file.missingFields?.category ? <li>• Category: {file.missingFields.category}</li> : null}
                                  {file.missingFields?.bodyWeight ? <li>• Body Weight: {file.missingFields.bodyWeight}</li> : null}
                                  {file.missingFields?.fee ? <li>• Fee: {file.missingFields.fee}</li> : null}
                                </ul>
                                <p className="text-[8px] text-[#00E5FF] mt-1 pt-1 border-t border-white/10 uppercase cursor-pointer hover:underline text-center">Tap for Details</p>
                              </div>
                            </div>
                          )}
                          {file.status === 'error' && (
                            <span 
                              className="inline-flex items-center gap-1 text-[#FF5D73] bg-[#FF5D73]/5 px-2 py-0.5 rounded text-[8px] uppercase tracking-wider border border-[#FF5D73]/15 cursor-help"
                              title={file.errorMsg}
                            >
                              Failed
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =====================================================
            SECTION 4: FILTERS & BULK TOOLS
            ===================================================== */}
        <div className="bg-[#121A2B] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-white/5 pb-4">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Audit name or regional affiliate..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-10 pr-4 py-2 bg-[#0B1020] border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-[#00E5FF] font-semibold"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto py-1">
              {/* Merge duplicates triggers */}
              <button
                onClick={() => mergeDuplicates(false)}
                disabled={competitors.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7B61FF]/10 hover:bg-[#7B61FF]/20 border border-[#7B61FF]/20 text-[#7B61FF] rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center shrink-0"
              >
                <Layers className="w-4 h-4" />
                Merge Duplicates
              </button>

              <button
                onClick={() => setIsManualModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 border border-[#00E5FF]/25 text-[#00E5FF] rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                Add lifter
              </button>
            </div>
          </div>

          {/* Filter matrix */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-slate-300">
            {/* Gender Filter */}
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">Gender Group</label>
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="All">All Genders</option>
                <option value="Men">Men</option>
                <option value="Women">Women</option>
              </select>
            </div>

            {/* Division Filter */}
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">Age category</label>
              <select
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="All">All Divisions</option>
                {DIVISIONS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Regional Unit Filter */}
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">Regional Units</label>
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-slate-200 focus:outline-none cursor-pointer truncate"
              >
                <option value="All">All Districts</option>
                {activeDistrictsList.map(dist => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
              </select>
            </div>

            {/* Validation Filter */}
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">Validation Index</label>
              <select
                value={filterValidation}
                onChange={(e) => setFilterValidation(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="All">All Entries</option>
                <option value="Valid">Valid (Verified)</option>
                <option value="Review">Requires Review</option>
                <option value="Invalid">Invalid Entries</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions Glass Tray */}
          {selectedIds.size > 0 && (
            <div className="p-4 bg-gradient-to-r from-[#121A2B] to-[#7B61FF]/10 border border-white/10 rounded-xl mt-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 font-mono text-xs">
                <CheckCircle className="w-4 h-4 text-[#7B61FF] shrink-0" />
                <span>Selected: <strong className="text-white font-extrabold">{selectedIds.size} lifters</strong></span>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                {/* Mass District */}
                <select
                  value={bulkDistrict}
                  onChange={(e) => setBulkDistrict(e.target.value)}
                  className="text-xs px-2.5 py-2 bg-[#0B1020] border border-white/10 rounded-xl text-slate-200 focus:outline-none max-w-[130px] cursor-pointer"
                >
                  <option value="">Move to District</option>
                  {OFFICIAL_DISTRICTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* Mass Gender */}
                <select
                  value={bulkGender}
                  onChange={(e) => setBulkGender(e.target.value)}
                  className="text-xs px-2.5 py-2 bg-[#0B1020] border border-white/10 rounded-xl text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="Unchanged">Gender: Unchanged</option>
                  <option value="Men">Men</option>
                  <option value="Women">Women</option>
                </select>

                {/* Mass Division */}
                <select
                  value={bulkDivision}
                  onChange={(e) => setBulkDivision(e.target.value)}
                  className="text-xs px-2.5 py-2 bg-[#0B1020] border border-white/10 rounded-xl text-[#E2E8F0] focus:outline-none max-w-[124px] cursor-pointer"
                >
                  <option value="Unchanged">Div: Unchanged</option>
                  {DIVISIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <button
                  onClick={handleBulkAssign}
                  className="px-4 py-2 bg-[#7B61FF] hover:bg-[#7B61FF]/90 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Bulk Assign
                </button>

                <button
                  onClick={handleBulkDelete}
                  className="p-2 border border-[#FF5D73]/30 text-[#FF5D73] hover:bg-[#FF5D73]/5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =====================================================
            SECTION 5: ATHLETE LIST BOARD (FULL HEIGHT, NO SCROLL)
            ===================================================== */}
        <div className="bg-[#121A2B] border border-white/[0.08] rounded-2xl shadow-xl overflow-visible flex flex-col h-auto max-h-none">
          <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#00E5FF] font-mono flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#00E5FF]" />
              Athletes
            </h3>
            <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-lg">
              Entries Filtered: <strong className="text-[#00E5FF]">{sortedProcessedList.length}</strong> / total {competitors.length} listed
            </span>
          </div>

          {/* Desktop view: Renders full Table layout without nested scrolling */}
          <div className="hidden md:block w-full overflow-visible h-auto max-h-none">
            <table className="w-full text-left border-collapse text-xs select-text overflow-visible h-auto max-h-none">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-bold bg-[#0B1020]/20 font-mono text-[9px] uppercase tracking-wider select-none">
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={sortedProcessedList.length > 0 && sortedProcessedList.every(c => selectedIds.has(c.id))}
                      onChange={() => toggleAllSelection(sortedProcessedList)}
                      className="w-3.5 h-3.5 accent-[#00E5FF] cursor-pointer"
                    />
                  </th>
                  <th className="p-4">Status</th>
                  <th 
                    className="p-4 cursor-pointer hover:text-white select-none whitespace-nowrap"
                    onClick={() => {
                      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                      setSortField('name');
                    }}
                  >
                    Competitor/Athlete {sortField === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th 
                    className="p-4 cursor-pointer hover:text-white select-none whitespace-nowrap"
                    onClick={() => {
                      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                      setSortField('district');
                    }}
                  >
                    District affiliate {sortField === 'district' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-4">Gender</th>
                  <th className="p-4">Weight Class</th>
                  <th className="p-4">Age division</th>
                  <th className="p-4">Championship Cat</th>
                  <th 
                    className="p-4 cursor-pointer hover:text-white select-none whitespace-nowrap text-right"
                    onClick={() => {
                      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                      setSortField('entry_fee');
                    }}
                  >
                    Fee (INR) {sortField === 'entry_fee' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05] overflow-visible">
                {sortedProcessedList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-500 italic font-mono uppercase tracking-widest text-[10px]">
                      Empty board state. Correct filters or ingest lifters from the interface channels.
                    </td>
                  </tr>
                ) : (
                  sortedProcessedList.map((item) => {
                    const vState = getValidationState(item);
                    const isSelected = selectedIds.has(item.id);
                    const hasDuplicateName = duplicateNames.has(item.name.trim().toUpperCase());

                    return (
                      <tr 
                        key={item.id}
                        className={`group border-b border-white/[0.03] hover:bg-[#00E5FF]/[0.02] cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#7B61FF]/[0.03]' : ''
                        }`}
                        onClick={() => setSelectedAthleteIdForDrawer(item.id)}
                      >
                        {/* Checkbox */}
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(item.id)}
                            className="w-3.5 h-3.5 accent-[#00E5FF] cursor-pointer"
                          />
                        </td>

                        {/* Validation Status Badge */}
                        <td className="p-4 select-none">
                          {vState === 'complete' && (
                            <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#00D084]/10 border border-[#00D084]/20 text-[#00D084] font-bold uppercase rounded font-mono">
                              ✓ Complete
                            </span>
                          )}
                          {vState === 'needs_review' && (
                            <span 
                              className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#FFB547]/10 border border-[#FFB547]/20 text-[#FFB547] font-bold uppercase rounded font-mono"
                              title={`Requires manual review due to missing data or low trust confidence`}
                            >
                              ⚠ Needs Review
                            </span>
                          )}
                        </td>

                        {/* Competitor Name */}
                        <td className="p-4 font-bold text-white uppercase tracking-tight font-mono max-w-[180px] truncate" title={item.name}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{item.name}</span>
                            {hasDuplicateName && (
                              <span 
                                className="inline-flex items-center gap-0.5 bg-[#FFB547]/10 text-[#FFB547] border border-[#FFB547]/15 font-mono text-[8px] px-1 py-0.1 rounded font-bold uppercase shrink-0 cursor-help"
                                title="⚠ Possible Duplicate. Use Merge tools."
                              >
                                ⚠ Possible Duplicate
                              </span>
                            )}
                          </div>
                        </td>

                        {/* District Affiliate */}
                        <td className="p-4 text-slate-300 max-w-[140px] truncate" title={item.district || ''}>
                          {item.district || renderMissing()}
                        </td>

                        {/* Gender Badging */}
                        <td className="p-4">
                          {item.gender ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] ${
                              item.gender === 'Women' 
                                ? 'bg-[#7B61FF]/10 text-[#7B61FF]' 
                                : 'bg-[#00E5FF]/10 text-[#00E5FF]'
                            }`}>
                              {item.gender}
                            </span>
                          ) : renderMissing()}
                        </td>

                        {/* Weight class */}
                        <td className="p-4 font-mono font-bold text-slate-100">
                          {item.bodyweight_category ? `${item.bodyweight_category} kg` : renderMissing()}
                        </td>

                        {/* Division */}
                        <td className="p-4 text-slate-350">{item.division || renderMissing()}</td>

                        {/* Category */}
                        <td className="p-4 text-slate-350">{item.category || renderMissing()}</td>

                        {/* Fee in Rupees */}
                        <td className="p-4 text-right font-mono font-extrabold text-[#00D084]">
                          {item.entry_fee ? `₹${item.entry_fee}` : renderMissing()}
                        </td>

                        {/* Row Action buttons */}
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedAthleteIdForDrawer(item.id)}
                              className="p-1 text-slate-400 hover:text-[#00E5FF] hover:bg-white/5 rounded-md transition-colors"
                              title="Expand profile details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAthlete(item.id)}
                              className="p-1 text-slate-450 hover:text-[#FF5D73] hover:bg-white/5 rounded-md transition-colors"
                              title="Delete competitor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile view: Stacked Athlete cards to protect layout, eliminating horizontal scroll */}
          <div className="block md:hidden p-4 space-y-4 overflow-visible h-auto max-h-none">
            {sortedProcessedList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 italic font-mono uppercase tracking-widest text-[10px] bg-[#0B1020]/40 rounded-xl border border-white/5">
                Empty board state. Correct filters or ingest lifters.
              </div>
            ) : (
              sortedProcessedList.map((item) => {
                const vState = getValidationState(item);
                const isSelected = selectedIds.has(item.id);
                const hasDuplicateName = duplicateNames.has(item.name.trim().toUpperCase());

                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedAthleteIdForDrawer(item.id)}
                    className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-3 relative ${
                      isSelected 
                        ? 'bg-[#7B61FF]/[0.05] border-[#7B61FF]/40 shadow-md' 
                        : 'bg-[#0B1020]/60 border-white/[0.06] hover:border-white/10'
                    }`}
                  >
                    {/* Head Row with actions and checkbox */}
                    <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(item.id)}
                          className="w-4 h-4 accent-[#00E5FF] cursor-pointer"
                        />
                        {vState === 'complete' && (
                          <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#00D084]/10 border border-[#00D084]/20 text-[#00D084] font-bold uppercase rounded font-mono">
                            ✓ Complete
                          </span>
                        )}
                        {vState === 'needs_review' && (
                          <span 
                            className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#FFB547]/10 border border-[#FFB547]/20 text-[#FFB547] font-bold uppercase rounded font-mono"
                            title={`Requires manual review due to missing data or low trust confidence`}
                          >
                            ⚠ Needs Review
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedAthleteIdForDrawer(item.id)}
                          className="p-1.5 text-slate-400 hover:text-[#00E5FF] hover:bg-white/5 rounded-md transition-colors"
                          title="Expand profile details"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAthlete(item.id)}
                          className="p-1.5 text-slate-450 hover:text-[#FF5D73] hover:bg-white/5 rounded-md transition-colors"
                          title="Delete competitor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Name & duplicate badge */}
                    <div>
                      <h4 className="font-bold text-white uppercase tracking-tight font-mono text-xs flex items-center gap-2">
                        <span className="truncate">{item.name}</span>
                        {hasDuplicateName && (
                          <span 
                            className="inline-flex items-center gap-0.5 bg-[#FFB547]/10 text-[#FFB547] border border-[#FFB547]/15 font-mono text-[8px] px-1.5 py-0.2 rounded font-bold uppercase cursor-help"
                            title="⚠ Possible Duplicate. Use Merge tools."
                          >
                            ⚠ Possible Duplicate
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono uppercase tracking-wider">
                        District Unit: {item.district || renderMissing()}
                      </p>
                    </div>

                    {/* Meta info grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-white/5 pt-2.5">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-mono">Gender Group</span>
                        {item.gender ? (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold text-[9px] mt-0.5 ${
                            item.gender === 'Women' 
                              ? 'bg-[#7B61FF]/10 text-[#7B61FF]' 
                              : 'bg-[#00E5FF]/10 text-[#00E5FF]'
                          }`}>
                            {item.gender}
                          </span>
                        ) : renderMissing()}
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-mono">IPF class</span>
                        <span className="text-slate-200 font-mono font-bold mt-0.5 block">{item.bodyweight_category ? `${item.bodyweight_category} kg` : renderMissing()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-mono">Age division</span>
                        <span className="text-slate-350 mt-0.5 block">{item.division || renderMissing()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-mono">Champ Category</span>
                        <span className="text-slate-350 mt-0.5 block">{item.category || renderMissing()}</span>
                      </div>
                    </div>

                    {/* Bottom Row fee */}
                    <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-1">
                      <span className="text-[10px] text-slate-450 font-mono uppercase">Registration Fee</span>
                      <span className="text-sm font-black text-[#00D084] font-mono">{item.entry_fee ? `₹${item.entry_fee}` : renderMissing()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Natural Expansion details footer */}
          <div className="p-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 select-none gap-2">
            <span>Roster index rendering: <strong className="text-white font-semibold">{processedList.length} athletes</strong> matching filters</span>
            <span className="font-mono">Total Board: {competitors.length} listed</span>
          </div>
        </div>

        {/* =====================================================
            SECTION 6: IPF CATEGORY WISE LIST PREVIEW (Category Lists)
            ===================================================== */}
        <div className="bg-[#121A2B] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-[#00E5FF] font-mono flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#00E5FF]" />
                Category Lists
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-mono uppercase">
                Interactive real-time IPF bodyweight division breakdown
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadCategoryWisePDF}
                disabled={competitors.length === 0}
                className="px-3 py-1.5 bg-[#FF5D73]/10 hover:bg-[#FF5D73]/20 border border-[#FF5D73]/30 text-white rounded-xl text-[10px] uppercase font-mono tracking-wider font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <FileText className="w-3.5 h-3.5 text-[#FF5D73]" />
                Category PDF
              </button>
              <button
                onClick={exportCategoryWiseJSON}
                disabled={competitors.length === 0}
                className="px-3 py-1.5 bg-[#00D084]/15 hover:bg-[#00D084]/25 border border-[#00D084]/30 text-white rounded-xl text-[10px] uppercase font-mono tracking-wider font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Layers className="w-3.5 h-3.5 text-[#00D084]" />
                Category JSON
              </button>
            </div>
          </div>

          {competitors.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs uppercase">
              No entries populated. Upload a roster stream to see the IPF categories index.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
              {/* Men Categories */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-[#00E5FF] tracking-widest font-mono uppercase border-b border-white/5 pb-1">
                  ♂ MEN DIVISIONS
                </h4>
                {(() => {
                  const { structure, menCategories, allDivisions } = buildCategoryWiseData(competitors);
                  let displayedAny = false;
                  return (
                    <div className="space-y-2">
                      {menCategories.map(cat => {
                        let hasAthletes = false;
                        allDivisions.forEach(div => {
                          if (structure.Men[cat][div].length > 0) hasAthletes = true;
                        });
                        if (!hasAthletes) return null;
                        displayedAny = true;
                        return (
                          <div key={`m-${cat}`} className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-2">
                            <span className="text-[10px] font-bold text-white uppercase font-mono">{cat}</span>
                            <div className="space-y-1.5 pl-2 border-l border-white/5">
                              {allDivisions.map(div => {
                                const list = structure.Men[cat][div];
                                if (list.length === 0) return null;
                                return (
                                  <div key={`m-${cat}-${div}`} className="text-[10px] font-mono">
                                    <span className="text-[#7B61FF] font-bold">{div}</span>
                                    <ul className="mt-0.5 space-y-0.5 pl-2 text-slate-350">
                                      {list.map((ath: any, athIdx: number) => (
                                        <li key={athIdx}>
                                          {athIdx + 1}. {ath.name} ({ath.district})
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {!displayedAny && (
                        <div className="text-[10px] text-slate-500 font-mono italic">No male registrations.</div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Women Categories */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-[#7B61FF] tracking-widest font-mono uppercase border-b border-white/5 pb-1">
                  ♀ WOMEN DIVISIONS
                </h4>
                {(() => {
                  const { structure, womenCategories, allDivisions } = buildCategoryWiseData(competitors);
                  let displayedAny = false;
                  return (
                    <div className="space-y-2">
                      {womenCategories.map(cat => {
                        let hasAthletes = false;
                        allDivisions.forEach(div => {
                          if (structure.Women[cat][div].length > 0) hasAthletes = true;
                        });
                        if (!hasAthletes) return null;
                        displayedAny = true;
                        return (
                          <div key={`w-${cat}`} className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-2">
                            <span className="text-[10px] font-bold text-white uppercase font-mono">{cat}</span>
                            <div className="space-y-1.5 pl-2 border-l border-white/5">
                              {allDivisions.map(div => {
                                const list = structure.Women[cat][div];
                                if (list.length === 0) return null;
                                return (
                                  <div key={`w-${cat}-${div}`} className="text-[10px] font-mono">
                                    <span className="text-[#00E5FF] font-bold">{div}</span>
                                    <ul className="mt-0.5 space-y-0.5 pl-2 text-slate-350">
                                      {list.map((ath: any, athIdx: number) => (
                                        <li key={athIdx}>
                                          {athIdx + 1}. {ath.name} ({ath.district})
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {!displayedAny && (
                        <div className="text-[10px] text-slate-500 font-mono italic">No female registrations.</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* =====================================================
            SECTION 7: DISTRICT ANALYTICS (Analytics)
            ===================================================== */}
        <div className="bg-[#121A2B] border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#00E5FF] font-mono flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-[#00E5FF]" />
            Analytics
          </h3>
          <AnalyticsCharts competitors={competitors} />
        </div>

        {/* =====================================================
            SECTION 8: DIAGNOSTICS
            ===================================================== */}
        <div className="p-4 bg-[#121A2B]/80 rounded-xl border border-white/5 space-y-3">
          <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 font-semibold">
            <Info className="w-3.5 h-3.5 text-[#00E5FF]" />
            Diagnostics
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="text-[#00D084] font-bold">✓</span>
              <span className="text-slate-350">WBSPA fuzzy maps loaded</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#00D084] font-bold">✓</span>
              <span className="text-slate-350">Attempts index online</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={summaryKPIs.reviews === 0 ? 'text-[#00D084] font-bold' : 'text-[#FFB547] font-bold animate-pulse'}>
                {summaryKPIs.reviews === 0 ? '✓' : '!'}
              </span>
              <span className="text-slate-350">
                {summaryKPIs.reviews === 0 ? 'All athletes verified' : `${summaryKPIs.reviews} lifters await check`}
              </span>
            </div>
          </div>
        </div>

      </main>

      {/* =====================================================
          FLOATING ACTION BUTTONS PANEL
          ===================================================== */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        {/* Copy JSON floating shortcut */}
        <button
          onClick={copyJSONToClipboard}
          disabled={competitors.length === 0}
          className="w-10 h-10 bg-[#121A2B] hover:bg-[#121A2B]/90 border border-white/10 text-[#00E5FF] flex items-center justify-center rounded-full shadow-lg hover:shadow-cyan-500/10 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group relative"
          title="Copy compiled JSON"
        >
          <Copy className="w-4 h-4" />
          <span className="absolute right-12 bg-black text-white text-[9px] font-mono px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Copy JSON Clipboard
          </span>
        </button>

        {/* Download CSV floating shortcut */}
        <button
          onClick={downloadCSV}
          disabled={competitors.length === 0}
          className="w-10 h-10 bg-[#121A2B] hover:bg-[#121A2B]/90 border border-white/10 text-[#7B61FF] flex items-center justify-center rounded-full shadow-lg hover:shadow-purple-500/10 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group relative"
          title="Download CSV spreadsheet"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span className="absolute right-12 bg-black text-white text-[9px] font-mono px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Download CSV
          </span>
        </button>

        {/* Core Primary: Add Athlete Trigger */}
        <button
          onClick={() => setIsManualModalOpen(true)}
          className="w-12 h-12 bg-gradient-to-tr from-[#00E5FF] to-[#7B61FF] text-black flex items-center justify-center rounded-full shadow-xl hover:shadow-[#00E5FF]/20 hover:scale-110 active:scale-95 transition-all cursor-pointer group relative"
          title="Add athlete manual entry"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span className="absolute right-14 bg-black text-white text-[9px] font-mono px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Add Athlete Manual
          </span>
        </button>
      </div>


      {/* --- OVERLAYS CHANNELS --- */}
      
      {/* 1. Athlete Slide Drawer profile */}
      <AnimatePresence>
        {selectedAthleteForDrawer && (
          <DetailsDrawer
            athlete={selectedAthleteForDrawer}
            onClose={() => setSelectedAthleteIdForDrawer(null)}
            onSave={handleSaveEditedAthlete}
            onDelete={handleDeleteAthlete}
          />
        )}
      </AnimatePresence>

      {/* 2. Quick Manual form modal */}
      {isManualModalOpen && (
        <ManualEntryModal
          onClose={() => setIsManualModalOpen(false)}
          onAdd={(newAthlete) => {
            setCompetitors((prev) => [newAthlete, ...prev]);
            setSelectedIds(new Set());
          }}
        />
      )}

      {/* 3. Import Summary Modal */}
      <AnimatePresence>
        {importSummary?.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#121A2B] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative"
            >
              <div className="flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-[#00D084]/15 text-[#00D084] flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono mb-1">
                  IMPORT COMPLETED
                </h2>
                
                <div className="flex w-full items-center justify-between bg-black/30 border border-white/5 rounded-lg p-3 mt-4 text-xs font-mono">
                  <span className="text-slate-400">Imported:</span>
                  <span className="text-[#00D084] font-bold">{importSummary.imported} lifters</span>
                </div>

                <div className="flex w-full items-center justify-between bg-black/30 border border-white/5 rounded-lg p-3 mt-2 text-xs font-mono">
                  <span className="text-slate-400">Needs Review:</span>
                  <span className="text-[#FFB547] font-bold">{importSummary.needsReview} lifters</span>
                </div>

                {importSummary.needsReview > 0 && (
                  <div className="w-full mt-4 bg-[#FFB547]/5 border border-[#FFB547]/10 rounded-lg p-3">
                    <h3 className="text-[10px] font-bold text-[#FFB547] uppercase tracking-wider mb-2 font-mono flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Missing Fields:
                    </h3>
                    <ul className="text-[10px] text-slate-300 space-y-1 font-mono">
                      {importSummary.missingGender > 0 && <li>• Gender: {importSummary.missingGender}</li>}
                      {importSummary.missingBodyWeight > 0 && <li>• Body Weight: {importSummary.missingBodyWeight}</li>}
                      {importSummary.missingCategory > 0 && <li>• Category: {importSummary.missingCategory}</li>}
                      {importSummary.missingFee > 0 && <li>• Fee: {importSummary.missingFee}</li>}
                    </ul>
                  </div>
                )}

                <div className="w-full flex flex-col gap-2 mt-6">
                  {importSummary.needsReview > 0 && (
                    <button
                      onClick={() => {
                        setImportSummary(null);
                        setFilterValidation('Review');
                      }}
                      className="w-full py-2.5 bg-[#FFB547] hover:bg-[#FFB547]/90 text-black font-bold uppercase tracking-wider text-[10px] rounded-xl transition-colors font-mono cursor-pointer"
                    >
                      Review Missing Data
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setImportSummary(null);
                      mergeDuplicates(true);
                    }}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-wider text-[10px] rounded-xl transition-colors font-mono cursor-pointer border border-white/10"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {duplicateClusters.length > 0 && (
          <DuplicateResolutionModal 
            clusters={duplicateClusters}
            onComplete={handleDuplicateResolutionComplete}
            onClose={() => setDuplicateClusters([])}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
