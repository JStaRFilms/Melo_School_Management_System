import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { PlatformMockShell } from '../components/PlatformMockShell';
import { Users, TrendingUp, BookOpen, Clock } from 'lucide-react';
import { Cursor } from '../components/Cursor';

export const AdminOverviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const popIn = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  // Cursor logic
  const cursorX = interpolate(frame, [20, 60], [1400, 450], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const cursorY = interpolate(frame, [20, 60], [800, 350], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const clicked = frame > 60 && frame < 70;

  return (
    <AbsoluteFill>
      <PlatformMockShell activeSection="School Overview" activeGroup="management">
        <div className="flex flex-col gap-8 h-full">
          <div>
            <h1 className="text-3xl font-serif text-slate-900 tracking-tight">System Core</h1>
            <p className="text-slate-500 mt-2 font-medium">Lekki Campus • 2026/2027 Academic Year</p>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-6">
            {[
              { icon: Users, label: "Active Students", value: "842", plus: "+12" },
              { icon: BookOpen, label: "Active Classes", value: "34", plus: "0" },
              { icon: TrendingUp, label: "Term Revenue", value: "₦42.5M", plus: "+15%" },
              { icon: Clock, label: "Pending Actions", value: "14", plus: null },
            ].map((stat, i) => {
              const cardPop = spring({
                frame: frame - i * 5 - 5,
                fps,
                config: { damping: 14 }
              });
              
              const isTarget = i === 1;
              const hoverState = isTarget && frame > 60 ? 0.05 : 0;

              return (
                <div 
                  key={stat.label}
                  style={{
                    transform: `scale(${cardPop + hoverState})`,
                    opacity: interpolate(cardPop, [0, 1], [0, 1])
                  }}
                  className={`bg-white border text-left border-slate-200 rounded-2xl p-6 shadow-sm transition-colors ${isTarget && frame > 60 ? 'border-blue-500/50 bg-blue-50/10' : ''}`}
                >
                   <div className="h-10 w-10 text-slate-900 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                      <stat.icon className="h-5 w-5" />
                   </div>
                   <p className="text-sm font-bold text-slate-500">{stat.label}</p>
                   <div className="flex items-end gap-3 mt-1">
                      <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                      {stat.plus && <p className="text-xs font-bold text-emerald-500 mb-1">{stat.plus}</p>}
                   </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-3 gap-6 flex-1">
             <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6"
                style={{
                  transform: `translateY(${interpolate(popIn, [0, 1], [40, 0])}px)`,
                  opacity: interpolate(popIn, [0, 1], [0, 1])
                }}
             >
                <div className="flex justify-between items-center">
                   <h3 className="font-bold text-slate-900">Recent Activity</h3>
                </div>
                <div className="flex-1 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-6">
                   <div className="w-full h-full flex items-end gap-4">
                       {[40, 60, 45, 80, 50, 90, 75, 100].map((h, i) => (
                           <div key={i} className="flex-1 bg-blue-100/50 rounded-t-lg overflow-hidden" style={{ height: `${h}%`}}>
                              <div className="w-full bg-blue-600 rounded-t-lg" style={{ height: `${interpolate(frame - 15 - i*2, [0, 20], [0, 100], { extrapolateRight: 'clamp' })}%`}} />
                           </div>
                       ))}
                   </div>
                </div>
             </div>
             
             <div className="col-span-1 bg-slate-950 rounded-2xl p-6 shadow-sm flex flex-col gap-4"
               style={{
                  transform: `translateY(${interpolate(popIn, [0, 1], [40, 0])}px)`,
                  opacity: interpolate(popIn, [0, 1], [0, 1])
                }}
             >
                <h3 className="font-bold text-white">Action Items</h3>
                <div className="flex flex-col gap-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <div className="h-4 w-3/4 bg-white/20 rounded mb-3" />
                      <div className="h-3 w-1/2 bg-white/10 rounded" />
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
        <Cursor x={cursorX} y={cursorY} clicked={clicked} />
      </PlatformMockShell>
    </AbsoluteFill>
  );
};
