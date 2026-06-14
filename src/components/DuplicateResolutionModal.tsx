import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Check, X, Layers } from 'lucide-react';
import { Competitor } from '../types';

interface DuplicateCluster {
  key: string;
  records: Competitor[];
}

interface DuplicateResolutionModalProps {
  clusters: DuplicateCluster[];
  onComplete: (resolvedRecords: Competitor[]) => void;
  onClose: () => void;
}

export function DuplicateResolutionModal({ clusters, onComplete, onClose }: DuplicateResolutionModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolved, setResolved] = useState<Competitor[]>([]);

  if (clusters.length === 0) {
    onClose();
    return null;
  }

  const currentCluster = clusters[currentIndex];

  const handleNext = (newRecords: Competitor[]) => {
    const nextResolved = [...resolved, ...newRecords];
    if (currentIndex + 1 >= clusters.length) {
      onComplete(nextResolved);
    } else {
      setResolved(nextResolved);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleMerge = () => {
    // Merge all records in this cluster incrementally
    const merged: Competitor = { ...currentCluster.records[0] };
    for (let i = 1; i < currentCluster.records.length; i++) {
      const current = currentCluster.records[i];
      if (!merged.district && current.district) {
        merged.district = current.district;
        merged.districtAssociation = current.districtAssociation;
        merged.districtConfidence = current.districtConfidence;
      }
      if (!merged.bodyweight_category && current.bodyweight_category) merged.bodyweight_category = current.bodyweight_category;
      if (!merged.division && current.division) merged.division = current.division;
      if (!merged.category && current.category) merged.category = current.category;
      if (!merged.entry_fee && current.entry_fee) merged.entry_fee = current.entry_fee;
      if (!merged.phone_number && current.phone_number) merged.phone_number = current.phone_number;
    }
    handleNext([merged]);
  };

  const handleKeepBoth = () => {
    // Keep all records as they are
    handleNext(currentCluster.records);
  };

  const handleSkip = () => {
    // Keep them as they are, identical to Keep Both for this context unless they meant skip merging. Keep both is effectively skipping the merge.
    handleNext(currentCluster.records);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#121A2B] border border-[#FFB547]/30 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#FFB547]/5 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FFB547]/20 flex items-center justify-center text-[#FFB547]">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono">
                ⚠ Possible Duplicate
              </h2>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Cluster {currentIndex + 1} of {clusters.length}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <p className="text-xs text-slate-300 font-mono mb-4">
            We found multiple records matching <strong className="text-white">{currentCluster.key}</strong>.
          </p>
          <div className="space-y-3">
            {currentCluster.records.map((rec, i) => (
              <div key={rec.id} className="p-4 bg-black/40 border border-white/5 rounded-xl text-xs font-mono">
                <div className="grid grid-cols-2 gap-y-2">
                  <div><span className="text-slate-500">Name:</span> <span className="text-white font-bold">{rec.name}</span></div>
                  <div><span className="text-slate-500">Gender:</span> <span className="text-white">{rec.gender}</span></div>
                  <div><span className="text-slate-500">Category:</span> <span className="text-[#00E5FF]">{rec.category}</span></div>
                  <div><span className="text-slate-500">Division:</span> <span className="text-white">{rec.division}</span></div>
                  <div><span className="text-slate-500">Weight:</span> <span className="text-white">{rec.bodyweight_category}</span></div>
                  <div><span className="text-slate-500">District:</span> <span className="text-white">{rec.district}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 border-t border-white/10 flex flex-wrap gap-3 bg-black/20 rounded-b-2xl">
          <button onClick={handleMerge} className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00D084] hover:bg-[#00D084]/90 text-black rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer font-mono">
            <Layers className="w-3.5 h-3.5" /> Merge
          </button>
          <button onClick={handleKeepBoth} className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7B61FF]/20 hover:bg-[#7B61FF]/30 text-[#7B61FF] border border-[#7B61FF]/30 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer font-mono">
            <Check className="w-3.5 h-3.5" /> Keep Both
          </button>
          <button onClick={handleSkip} className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer font-mono">
            Skip
          </button>
        </div>
      </motion.div>
    </div>
  );
}
