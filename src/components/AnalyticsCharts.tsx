import React, { useMemo } from 'react';
import { Shield, TrendingUp, Users, MapPin, Award, Activity } from 'lucide-react';
import { Competitor } from '../types';

interface AnalyticsChartsProps {
  competitors: Competitor[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ competitors }) => {
  // 1. Calculate active statistics
  const metrics = useMemo(() => {
    let men = 0;
    let women = 0;
    let totalFees = 0;
    const districts: Record<string, { total: number; men: number; women: number; fees: number }> = {};
    const divisions: Record<string, number> = {};

    competitors.forEach((c) => {
      if (c.gender === 'Women') women++;
      else men++;

      totalFees += c.entry_fee || 0;

      const dName = c.district || 'Unassigned Unit';
      if (!districts[dName]) {
        districts[dName] = { total: 0, men: 0, women: 0, fees: 0 };
      }
      districts[dName].total++;
      if (c.gender === 'Women') districts[dName].women++;
      else districts[dName].men++;
      districts[dName].fees += c.entry_fee || 0;

      if (c.division) {
        divisions[c.division] = (divisions[c.division] || 0) + 1;
      }
    });

    const sortedDistricts = Object.entries(districts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    const sortedDivisions = Object.entries(divisions)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      men,
      women,
      totalFees,
      districts: sortedDistricts,
      divisions: sortedDivisions,
      hasData: competitors.length > 0
    };
  }, [competitors]);

  if (!metrics.hasData) {
    return (
      <div className="bg-[#121A2B] border border-white/[0.08] p-8 rounded-2xl text-center space-y-4 shadow-xl">
        <Activity className="w-8 h-8 text-[#00E5FF]/40 mx-auto animate-pulse" />
        <h3 className="text-white text-xs font-bold uppercase tracking-widest font-mono">No telemetry data computed</h3>
        <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
          Import a spreadsheet, scanned PDF, or screenshot roster to trigger district heatmaps, turnout summaries, and fees audits.
        </p>
      </div>
    );
  }

  const maxAthletesInDistrict = metrics.districts[0]?.total || 1;
  const menRatio = (metrics.men / competitors.length) * 100;
  const womenRatio = (metrics.women / competitors.length) * 100;

  return (
    <div className="space-y-6">
      
      {/* Turnout Mix Segment Widget */}
      <div className="bg-[#121A2B] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-[#00E5FF] uppercase tracking-[0.2em] flex items-center gap-1.5 font-mono">
            <Users className="w-4 h-4 text-[#00E5FF]" />
            ATHLETE GENDER DISTRIBUTOR
          </h3>
          <span className="text-[9px] px-2 py-0.5 rounded border border-[#7B61FF]/20 bg-[#7B61FF]/5 text-[#7B61FF] font-extrabold uppercase tracking-widest font-mono">
            Ratios Compute
          </span>
        </div>

        {/* Circular SVG Donut Dashboard */}
        <div className="flex items-center justify-around gap-4 py-3">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* SVG circle rendering */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              {/* Back circle */}
              <circle 
                cx="18" 
                cy="18" 
                r="15.915" 
                fill="none" 
                stroke="rgba(255,255,255,0.02)" 
                strokeWidth="3.5" 
              />
              {/* Men segment (Blue/Cyan) */}
              <circle 
                cx="18" 
                cy="18" 
                r="15.915" 
                fill="none" 
                stroke="#00E5FF" 
                strokeWidth="3.5" 
                strokeDasharray={`${menRatio} ${100 - menRatio}`}
                strokeDashoffset="0"
                className="transition-all duration-500"
              />
              {/* Women segment (Violet/Purple) */}
              <circle 
                cx="18" 
                cy="18" 
                r="15.915" 
                fill="none" 
                stroke="#7B61FF" 
                strokeWidth="3.5" 
                strokeDasharray={`${womenRatio} ${100 - womenRatio}`}
                strokeDashoffset={-menRatio} 
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-xl font-extrabold text-white block leading-none font-mono">
                {competitors.length}
              </span>
              <span className="text-[8px] text-slate-400 uppercase tracking-widest font-mono">
                Total Units
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF]" />
                <span className="text-xs text-slate-350 font-semibold font-mono">Men Ratio:</span>
                <span className="text-xs font-extrabold text-white font-mono">{menRatio.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] text-slate-500 pl-4 font-mono">{metrics.men} registered athletes</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7B61FF]" />
                <span className="text-xs text-slate-350 font-semibold font-mono">Women Ratio:</span>
                <span className="text-xs font-extrabold text-white font-mono">{womenRatio.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] text-slate-500 pl-4 font-mono">{metrics.women} registered athletes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Districts level meter leaderboard */}
      <div className="bg-[#121A2B] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-[#00E5FF] uppercase tracking-[0.2em] flex items-center gap-1.5 font-mono">
            <MapPin className="w-4 h-4 text-[#00E5FF]" />
            DISTRICT TURNOUT TRACKS
          </h3>
          <span className="text-[9px] px-2 py-0.5 rounded border border-[#00D084]/20 bg-[#00D084]/5 text-[#00D084] font-extrabold uppercase tracking-widest font-mono">
            Official Units
          </span>
        </div>

        <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
          {metrics.districts.slice(0, 6).map((dist) => {
            const widthPercentage = (dist.total / maxAthletesInDistrict) * 100;
            const distMenRatio = dist.total > 0 ? (dist.men / dist.total) * 100 : 0;
            const distWomenRatio = dist.total > 0 ? (dist.women / dist.total) * 100 : 0;

            return (
              <div key={dist.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white uppercase tracking-tight truncate max-w-[150px]" title={dist.name}>
                    {dist.name}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400 font-semibold">{dist.total} lifters</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-[#00D084] font-extrabold">₹{dist.fees}</span>
                  </div>
                </div>

                {/* Turnout bars */}
                <div className="w-full bg-white/[0.04] h-2.5 rounded-full overflow-hidden relative border border-white/5 flex">
                  {dist.men > 0 && (
                    <div 
                      style={{ width: `${(dist.men / maxAthletesInDistrict) * 100}%` }}
                      className="bg-gradient-to-r from-[#00E5FF] to-[#00E5FF]/70 h-full transition-all duration-500 rounded-l"
                    />
                  )}
                  {dist.women > 0 && (
                    <div 
                      style={{ width: `${(dist.women / maxAthletesInDistrict) * 100}%` }}
                      className="bg-gradient-to-r from-[#7B61FF] to-[#7B61FF]/70 h-full transition-all duration-500"
                    />
                  )}
                </div>
                
                {/* Gender breakdown small indicator */}
                <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                  <span>Split: {dist.men} Men / {dist.women} Women</span>
                  <span>Turnout density: {widthPercentage.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Division Spread Breakdown */}
      <div className="bg-[#121A2B] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-4">
        <h3 className="text-[10px] font-bold text-[#00E5FF] uppercase tracking-[0.2em] flex items-center gap-1.5 font-mono">
          <Award className="w-4 h-4 text-[#00E5FF]" />
          AGE DIVISION POPULARITY MAP
        </h3>

        {metrics.divisions.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-4">No age division categorization loaded.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {metrics.divisions.slice(0, 4).map((div) => (
              <div 
                key={div.name}
                className="p-3 bg-[#0B1020] border border-white/5 rounded-xl shadow-inner space-y-1"
              >
                <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest font-semibold truncate" title={div.name}>
                  {div.name}
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-extrabold text-white font-mono leading-none">
                    {div.count}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono font-bold">
                    {((div.count / competitors.length) * 100).toFixed(0)}% mix
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
