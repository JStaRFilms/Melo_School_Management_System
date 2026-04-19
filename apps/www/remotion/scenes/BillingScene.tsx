import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { PlatformMockShell } from '../components/PlatformMockShell';
import { Cursor } from '../components/Cursor';

export const BillingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const popIn = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  // Cursor logic
  const cursorX = interpolate(frame, [40, 80], [1400, 300], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const cursorY = interpolate(frame, [40, 80], [120, 550], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const clicked = frame > 80 && frame < 90;

  return (
    <AbsoluteFill>
      <PlatformMockShell activeSection="Billing Dashboard" activeGroup="finance">
        <div className="flex flex-col gap-6 h-full">
           <div className="grid grid-cols-3 gap-6">
              {[
                  { label: "Total Expected", val: "₦142.5M", sub: "95% of target" },
                  { label: "Collected", val: "₦98.2M", sub: "68% collection rate", accent: "text-emerald-600" },
                  { label: "Outstanding", val: "₦44.3M", sub: "124 students pending", accent: "text-rose-600" },
              ].map((kpi, i) => (
                 <div key={kpi.label} 
                      className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm"
                      style={{
                         transform: `scale(${spring({ frame: frame - i*4, fps, config: { damping: 12 } })})`,
                      }}
                 >
                    <p className="text-sm font-bold text-slate-500">{kpi.label}</p>
                    <p className={`text-3xl font-bold mt-2 ${kpi.accent || 'text-slate-900'}`}>{kpi.val}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">{kpi.sub}</p>
                 </div>
              ))}
           </div>

           <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-4"
              style={{
                 transform: `translateY(${interpolate(popIn, [0, 1], [40, 0])}px)`,
                 opacity: interpolate(popIn, [0, 1], [0, 1])
              }}
           >
              <h3 className="font-bold text-slate-900">Recent Transactions</h3>
              <div className="flex-1 overflow-hidden">
                 <div className="grid grid-cols-5 text-xs font-bold text-slate-500 uppercase pb-3 border-b border-slate-100">
                    <div className="col-span-2">Student / Guardian</div>
                    <div>Reference</div>
                    <div>Amount</div>
                    <div>Status</div>
                 </div>
                 <div className="flex flex-col mt-2 gap-2">
                    {[
                       { name: "Adebayo, Oluwaseun", ref: "PAY-93821", amt: "₦450,000", stat: "Successful", bg: "bg-emerald-100 text-emerald-800" },
                       { name: "Okafor, Chidera", ref: "PAY-93820", amt: "₦450,000", stat: "Successful", bg: "bg-emerald-100 text-emerald-800" },
                       { name: "Ibrahim, Yusuf", ref: "PAY-93819", amt: "₦250,000", stat: "Pending", bg: "bg-amber-100 text-amber-800" },
                       { name: "Bello, Fatima", ref: "PAY-93818", amt: "₦450,000", stat: "Successful", bg: "bg-emerald-100 text-emerald-800" },
                    ].map((tx, i) => (
                       <div key={tx.ref} 
                            className={`grid grid-cols-5 text-sm items-center py-3 border-b border-slate-50 transition-colors ${i === 1 && frame > 80 ? 'bg-blue-50/50' : ''}`}
                            style={{
                               opacity: interpolate(frame - 15 - i*3, [0, 10], [0, 1], { extrapolateRight: 'clamp' })
                            }}
                       >
                          <div className="col-span-2 font-bold text-slate-900">{tx.name}</div>
                          <div className="text-slate-500 font-mono text-xs">{tx.ref}</div>
                          <div className="font-bold text-slate-900">{tx.amt}</div>
                          <div><span className={`px-2 py-1 rounded-md text-xs font-bold ${tx.bg}`}>{tx.stat}</span></div>
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
