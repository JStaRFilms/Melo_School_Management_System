import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { PlatformMockShell } from '../components/PlatformMockShell';
import { Cursor } from '../components/Cursor';

export const PortalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const popIn = spring({
    frame,
    fps,
    config: { damping: 14 }
  });

  // Cursor logic: move to Pay button
  const cursorX = interpolate(frame, [40, 90], [300, 400], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const cursorY = interpolate(frame, [40, 90], [550, 750], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const clicked = frame > 90 && frame < 100;

  return (
    <AbsoluteFill>
      <PlatformMockShell 
        workspaceLabel="Family Portal" 
        userName="Mr. Okafor" 
        activeSection="Academic Records" 
        hideSidebar={true}
      >
        <div className="flex flex-col h-full gap-8 max-w-5xl mx-auto mt-4">
           
           <div className="flex justify-between items-end">
              <div>
                 <h1 className="text-4xl font-serif text-slate-900 tracking-tight">Welcome, Emeka</h1>
                 <p className="text-lg text-slate-500 mt-2">Here is the latest from your children.</p>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-8">
              
              {/* Student Card */}
              <div 
                className="bg-white border-2 border-blue-100 rounded-3xl p-8 shadow-xl shadow-blue-900/5 relative overflow-hidden"
                style={{
                   transform: `translateY(${interpolate(popIn, [0, 1], [30, 0])}px)`,
                   opacity: interpolate(popIn, [0, 1], [0, 1])
                }}
              >
                 <div className="absolute top-0 right-0 p-6">
                    <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">Good Standing</div>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center text-xl font-bold text-slate-900 border-4 border-white shadow-sm">
                       CO
                    </div>
                    <div>
                       <h2 className="text-xl font-bold text-slate-900">Chidera Okafor</h2>
                       <p className="text-sm font-bold text-slate-500">JSS 3 Alpha</p>
                    </div>
                 </div>

                 <div className="mt-8 space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center group cursor-pointer hover:bg-blue-50 transition-colors">
                       <div>
                          <p className="font-bold text-slate-900">First Term Report Card</p>
                          <p className="text-xs text-slate-500">Published 2 days ago</p>
                       </div>
                       <div className="px-4 py-2 bg-white rounded-lg text-sm font-bold text-blue-600 shadow-sm border border-slate-200">
                          View
                       </div>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center transition-all duration-200">
                       <div>
                          <p className="font-bold text-slate-900">Second Term Fees</p>
                          <p className="text-xs text-slate-500">Due in 14 days</p>
                       </div>
                       <div className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-all duration-200 ${clicked ? 'bg-slate-800 scale-95' : 'bg-slate-900 scale-100'}`}>
                          Pay ₦450,000
                       </div>
                    </div>
                 </div>
              </div>

              {/* Second Student or general school announcement */}
              <div 
                className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col justify-center"
                style={{
                   transform: `translateY(${interpolate(spring({ frame: frame - 10, fps, config: { damping: 14 } }), [0, 1], [30, 0])}px)`,
                   opacity: interpolate(spring({ frame: frame - 10, fps, config: { damping: 14 } }), [0, 1], [0, 1])
                }}
              >
                  <div className="text-center space-y-4">
                     <div className="h-16 w-16 bg-blue-50 rounded-full mx-auto flex items-center justify-center">
                        <div className="h-8 w-8 bg-blue-500 rounded-full" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-900">Next Term Begins</h3>
                     <p className="text-slate-500">January 10th, 2027</p>
                     <p className="text-sm border-t border-slate-100 pt-4 mt-4 font-bold text-blue-600">View Full Calendar →</p>
                  </div>
              </div>

           </div>
        </div>
        <Cursor x={cursorX} y={cursorY} clicked={clicked} />
      </PlatformMockShell>
    </AbsoluteFill>
  );
};
