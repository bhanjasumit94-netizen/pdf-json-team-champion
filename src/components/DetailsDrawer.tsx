import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Save, Trash2, Award, Phone, AlignLeft, Shield, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { Competitor } from '../types';
import { OFFICIAL_DISTRICTS, DISTRICT_ASSOCIATION_MAP, IPF_MEN_WEIGHTS, IPF_WOMEN_WEIGHTS, DIVISIONS, CATEGORIES, getValidationState } from '../utils/districtUtils';

interface DetailsDrawerProps {
  athlete: Competitor | null;
  onClose: () => void;
  onSave: (updated: Competitor) => void;
  onDelete: (id: string) => void;
}

export const DetailsDrawer: React.FC<DetailsDrawerProps> = ({ athlete, onClose, onSave, onDelete }) => {
  const [formData, setFormData] = useState<Partial<Competitor>>({});

  useEffect(() => {
    if (athlete) {
      setFormData({ ...athlete });
    }
  }, [athlete]);

  if (!athlete) return null;

  const handleFieldChange = (field: keyof Competitor, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      
      // Auto-update association if district changes
      if (field === 'district' && value) {
        next.districtAssociation = DISTRICT_ASSOCIATION_MAP[value] || null;
        next.districtConfidence = 100;
        next.districtConfirmed = true;
      }
      
      // If gender changes, set a default matching weight class if previous one is invalid
      if (field === 'gender') {
        const allowed = value === 'Women' ? IPF_WOMEN_WEIGHTS : IPF_MEN_WEIGHTS;
        if (!allowed.includes(next.bodyweight_category || '')) {
          next.bodyweight_category = value === 'Women' ? '63' : '74';
        }
      }

      // Safe instantly as per requirements
      const finalNext = {
        ...next,
        name: (next.name || '').toUpperCase(),
        districtConfirmed: true,
      };

      if (athlete) {
        // use setTimeout to let React batch state if needed, or directly call onSave
        onSave({ ...athlete, ...finalNext } as Competitor);
      }

      return next;
    });
  };

  const validationState = getValidationState({ ...athlete, ...formData } as Competitor);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        className="fixed top-0 right-0 h-full w-full max-w-lg bg-[#121A2B] border-l border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-white/10 bg-[#0B1020]/80 backdrop-blur flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-[#00E5FF]/20 to-[#7B61FF]/10 rounded-xl border border-[#00E5FF]/20">
              <Award className="w-5 h-5 text-[#00E5FF]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight truncate max-w-[240px]">
                {formData.name || 'Athlete Details'}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                TELEMETRY PROFILE DIRECTORY
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Validation Status Indicator */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            validationState === 'complete'
              ? 'bg-[#00D084]/5 border-[#00D084]/20 text-[#00D084]'
              : 'bg-[#FFB547]/5 border-[#FFB547]/20 text-[#FFB547]'
          }`}>
            <div className="mt-0.5">
              {validationState === 'complete' && <CheckCircle className="w-4 h-4" />}
              {validationState === 'needs_review' && <AlertTriangle className="w-4 h-4" />}
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Status: {validationState.toUpperCase().replace('_', ' ')}
              </h4>
              <p className="text-[11px] text-slate-350 leading-relaxed mt-1">
                {validationState === 'complete' && 'All required fields are present. Entry is marked as complete.'}
                {validationState === 'needs_review' && `Missing required classifications (like name, weight class, gender, or regional unit) or unverified district detected.`}
              </p>
              {formData.districtConfidence !== undefined && formData.districtConfidence < 100 && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-black/40 border border-white/10 rounded font-mono text-[9px] text-slate-400">
                  <span>Match trust index:</span>
                  <span className={formData.districtConfidence >= 60 ? 'text-[#FFB547]' : 'text-[#FF5D73]'}>
                    {formData.districtConfidence}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields Dashboard */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-[#00E5FF] uppercase tracking-[0.15em] border-b border-white/5 pb-2">
              COMPETITOR CLASSIFICATION
            </h3>

            {/* Athlete Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Athlete Name (uppercase)</label>
              <input 
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00E5FF] font-medium"
                placeholder="FULL COMPETITOR NAME"
              />
            </div>

            {/* District & Affiliate Map */}
            <div className="grid grid-cols-1 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">District Unit Affiliation</label>
                <select
                  value={formData.district || ''}
                  onChange={(e) => handleFieldChange('district', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00E5FF]"
                >
                  <option value="">-- Choose verified affiliate --</option>
                  {OFFICIAL_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              {formData.districtAssociation && (
                <div className="px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg text-[10px] text-slate-400 font-mono">
                  <span className="text-[#7B61FF] font-bold block mb-0.5">OFFICIAL FEDERATION Affiliate:</span>
                  {formData.districtAssociation}
                </div>
              )}
            </div>

            {/* Gender and Weight Class */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Gender</label>
                <select
                  value={formData.gender || 'Men'}
                  onChange={(e) => handleFieldChange('gender', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00E5FF]"
                >
                  <option value="Men">Men</option>
                  <option value="Women">Women</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">IPF Weight Class</label>
                <select
                  value={formData.bodyweight_category || ''}
                  onChange={(e) => handleFieldChange('bodyweight_category', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00E5FF]"
                >
                  <option value="">-- Choose Category --</option>
                  {(formData.gender === 'Women' ? IPF_WOMEN_WEIGHTS : IPF_MEN_WEIGHTS).map((w) => (
                    <option key={w} value={w}>{w} kg Class</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Division & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Age Division</label>
                <select
                  value={formData.division || ''}
                  onChange={(e) => handleFieldChange('division', e.target.value || null)}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00E5FF]"
                >
                  <option value="">-- None Selected --</option>
                  {DIVISIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Competition Class</label>
                <select
                  value={formData.category || 'Senior'}
                  onChange={(e) => handleFieldChange('category', e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00E5FF]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Entry Fee & Source Page */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Entry Fee (INR)</label>
                <input 
                  type="number"
                  value={formData.entry_fee !== null && formData.entry_fee !== undefined ? formData.entry_fee : ''}
                  onChange={(e) => handleFieldChange('entry_fee', e.target.value ? Number(e.target.value) : null)}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00E5FF] font-mono"
                  placeholder="Fee in ₹"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Import Source Page</label>
                <input 
                  type="number"
                  disabled
                  value={formData.source_page || 1}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020]/40 border border-white/5 rounded-xl text-slate-400 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Core Attempts Tracker */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-[#7B61FF] uppercase tracking-[0.15em] border-b border-white/5 pb-2 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              FLIGHT ATTEMPTS (S / B / D)
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Squat Attempts</label>
                <input 
                  type="text"
                  placeholder="e.g. 140/150/155"
                  value={formData.attempts_squat || ''}
                  onChange={(e) => handleFieldChange('attempts_squat', e.target.value)}
                  className="w-full text-xs px-2.5 py-2 bg-[#0B1020] border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-[#7B61FF] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Bench attempts</label>
                <input 
                  type="text"
                  placeholder="e.g. 90/95/-"
                  value={formData.attempts_bench || ''}
                  onChange={(e) => handleFieldChange('attempts_bench', e.target.value)}
                  className="w-full text-xs px-2.5 py-2 bg-[#0B1020] border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-[#7B61FF] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Deadlift attempts</label>
                <input 
                  type="text"
                  placeholder="e.g. 180/195/202.5"
                  value={formData.attempts_deadlift || ''}
                  onChange={(e) => handleFieldChange('attempts_deadlift', e.target.value)}
                  className="w-full text-xs px-2.5 py-2 bg-[#0B1020] border border-white/10 rounded-lg text-white text-center focus:outline-none focus:border-[#7B61FF] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Contact Details and administrative Notes */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] border-b border-white/5 pb-2">
              ADMINISTRATIVE TRACKING
            </h3>

            {/* Phone Number */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-[#00E5FF]" />
                Primary Contact phone
              </label>
              <input 
                type="text"
                placeholder="+91 XXXXX XXXXX"
                value={formData.phone_number || ''}
                onChange={(e) => handleFieldChange('phone_number', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00E5FF] font-mono"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlignLeft className="w-3 h-3 text-[#7B61FF]" />
                Compliance Comments & Notes
              </label>
              <textarea
                placeholder="Roster deviations, custom fee agreements or classification logs..."
                rows={3}
                value={formData.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-slate-300 focus:outline-none focus:border-[#7B61FF]"
              />
            </div>
          </div>

        </div>

        {/* Drawer Footer Actions */}
        <div className="p-6 border-t border-white/10 bg-[#0B1020]/60 backdrop-blur flex justify-center">
          <button
            onClick={() => onDelete(athlete.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-transparent border border-[#FF5D73]/30 rounded-xl text-xs font-bold uppercase tracking-wider text-[#FF5D73] hover:bg-[#FF5D73]/10 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete Athlete Record
          </button>
        </div>
      </motion.div>
    </>
  );
};
