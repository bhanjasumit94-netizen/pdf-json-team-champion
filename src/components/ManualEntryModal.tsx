import React, { useState } from 'react';
import { X, Plus, Award, UserCheck } from 'lucide-react';
import { Competitor } from '../types';
import { OFFICIAL_DISTRICTS, DISTRICT_ASSOCIATION_MAP, IPF_MEN_WEIGHTS, IPF_WOMEN_WEIGHTS, DIVISIONS, CATEGORIES, fuzzyMatchDistrict } from '../utils/districtUtils';

interface ManualEntryModalProps {
  onClose: () => void;
  onAdd: (newAthlete: Competitor) => void;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    district: '',
    gender: 'Men' as 'Men' | 'Women',
    bodyweight_category: '74',
    division: 'Open' as any,
    category: 'Senior',
    entry_fee: '800',
    phone_number: '',
    notes: ''
  });

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => {
      const next = { ...prev, [field]: value };
      if (field === 'gender') {
        next.bodyweight_category = value === 'Women' ? '63' : '74';
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const rawDistrict = formData.district?.trim() || null;
    const { matchedDistrict, confidence } = fuzzyMatchDistrict(rawDistrict);
    const matchedAssoc = matchedDistrict ? (DISTRICT_ASSOCIATION_MAP[matchedDistrict] || null) : null;

    const newAthlete: Competitor = {
      id: `manual-${Date.now()}`,
      name: formData.name.trim().toUpperCase(),
      gender: formData.gender,
      bodyweight_category: formData.bodyweight_category,
      division: formData.division || null,
      category: formData.category || 'Senior',
      entry_fee: formData.entry_fee ? Number(formData.entry_fee) : null,
      source_page: 1,
      
      district: matchedDistrict || rawDistrict,
      districtAssociation: matchedAssoc,
      rawExtractedDistrict: rawDistrict,
      districtConfidence: matchedDistrict ? 100 : confidence,
      districtConfirmed: true, // Manually added are confirmed

      // Custom persistence parameters
      attempts_squat: '',
      attempts_bench: '',
      attempts_deadlift: '',
      phone_number: formData.phone_number,
      notes: formData.notes
    };

    onAdd(newAthlete);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg bg-[#121A2B] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00E5FF]/10 text-[#00E5FF] rounded-lg border border-[#00E5FF]/20">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase">Add Competitor Athlete</h3>
              <p className="text-[10px] text-slate-400 font-mono">MANUAL ENROLLMENT REGISTRY</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Athlete Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Athlete name</label>
            <input 
              type="text"
              required
              placeholder="e.g. AMIT CHAKRABORTY"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00E5FF] font-medium"
            />
          </div>

          {/* District Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">District Unit Affiliation</label>
            <select
              required
              value={formData.district}
              onChange={(e) => handleFieldChange('district', e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00E5FF]"
            >
              <option value="">-- Choose district unit --</option>
              {OFFICIAL_DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Gender and Weight class */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Gender Relation</label>
              <select
                value={formData.gender}
                onChange={(e) => handleFieldChange('gender', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none\"
              >
                <option value="Men">Men</option>
                <option value="Women">Women</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">IPF Weight class</label>
              <select
                value={formData.bodyweight_category}
                onChange={(e) => handleFieldChange('bodyweight_category', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none"
              >
                {(formData.gender === 'Women' ? IPF_WOMEN_WEIGHTS : IPF_MEN_WEIGHTS).map(w => (
                  <option key={w} value={w}>{w} kg</option>
                ))}
              </select>
            </div>
          </div>

          {/* Division & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Age division</label>
              <select
                value={formData.division}
                onChange={(e) => handleFieldChange('division', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white data-focus:border-[#00E5FF]"
              >
                {DIVISIONS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Championship Category</label>
              <select
                value={formData.category}
                onChange={(e) => handleFieldChange('category', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fee & Phone optional */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">Entry Fee (INR)</label>
              <input 
                type="number"
                value={formData.entry_fee}
                onChange={(e) => handleFieldChange('entry_fee', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Contact Phone</label>
              <input 
                type="text"
                placeholder="+91"
                value={formData.phone_number}
                onChange={(e) => handleFieldChange('phone_number', e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#0B1020] border border-white/10 rounded-xl text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex gap-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-transparent border border-white/10 text-slate-350 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-white/5 active:scale-[0.98] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#00E5FF] to-[#7B61FF] text-black font-extrabold rounded-xl text-xs uppercase tracking-wider hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-4 h-4 stroke-[2]" />
              Register Lifter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
