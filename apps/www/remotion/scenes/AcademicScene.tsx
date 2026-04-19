import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { PlatformMockShell } from '../components/PlatformMockShell';
import { Cursor } from '../components/Cursor';

export const AcademicScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const popIn = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  // Cursor logic: move to Publish button
  const cursorX = interpolate(frame, [30, 70], [450, 1400], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const cursorY = interpolate(frame, [30, 70], [350, 120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const clicked = frame > 70 && frame < 80;

  return (
    <AbsoluteFill>
      <PlatformMockShell activeSection="Report Cards" activeGroup="assessments">
        <div className="flex flex-col gap-6 h-full">
           <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm transition-colors">
              <div className="flex gap-4">
                 <div className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-bold text-slate-700">JSS 3 Alpha</div>
                 <div className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-bold text-slate-700">First Term 2026</div>
              </div>
              <div className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all duration-200 ${clicked ? 'bg-blue-700 scale-95' : 'bg-blue-600 scale-100'} text-white`}>
                Publish All
              </div>
           </div>

           <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex">
              <div className="w-1/3 border-r border-slate-100 flex flex-col">
                 <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-500">Student List</div>
                 <div className="flex-1 p-2 space-y-1">
                    {[
                      { name: "Adebayo, Oluwaseun", status: "Ready", score: "88%" },
                      { name: "Okafor, Chidera", status: "Ready", score: "92%" },
                      { name: "Nwachukwu, Emeka", status: "Draft", score: "74%" },
                      { name: "Bello, Fatima", status: "Ready", score: "81%" },
                    ].map((student, i) => (
                      <div key={student.name} className={`p-3 rounded-xl flex justify-between items-center ${i === 1 ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'}`}>
                         <div>
                            <p className={`text-sm font-bold ${i === 1 ? 'text-blue-900' : 'text-slate-900'}`}>{student.name}</p>
                            <p className="text-xs text-slate-500">{student.status}</p>
                         </div>
                         <div className="text-sm font-bold text-slate-900">{student.score}</div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="flex-1 bg-slate-50 p-8 flex items-center justify-center relative overflow-hidden">
                 <div 
                   className="w-[90%] h-full bg-white shadow-lg border border-slate-200 rounded-lg p-8 flex flex-col gap-6"
                   style={{
                      transform: `translateY(${interpolate(popIn, [0, 1], [40, 0])}px)`,
                      opacity: interpolate(popIn, [0, 1], [0, 1])
                   }}
                 >
                    <div className="text-center border-b border-slate-200 pb-4">
                       <h2 className="font-serif text-2xl font-bold text-slate-900">Melo High School</h2>
                       <p className="text-sm text-slate-500 mt-1">Terminal Assessment Report</p>
                    </div>

                    <div className="flex justify-between items-center text-sm font-medium">
                       <div><span className="text-slate-500">Name:</span> <span className="text-slate-900 font-bold">Okafor, Chidera</span></div>
                       <div><span className="text-slate-500">Class:</span> <span className="text-slate-900 font-bold">JSS 3 Alpha</span></div>
                    </div>

                    <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden">
                       <div className="bg-slate-100 p-3 grid grid-cols-4 font-bold text-xs text-slate-500">
                          <div className="col-span-2">Subject</div>
                          <div>CA (40)</div>
                          <div>Exam (60)</div>
                       </div>
                       {[
                         { sub: "Mathematics", ca: 34, ex: 55 },
                         { sub: "English Language", ca: 30, ex: 48 },
                         { sub: "Basic Science", ca: 38, ex: 58 },
                         { sub: "Civic Education", ca: 35, ex: 52 },
                       ].map((row, i) => (
                          <div key={row.sub} className="p-3 grid grid-cols-4 text-sm border-t border-slate-100">
                             <div className="col-span-2 font-bold text-slate-900">{row.sub}</div>
                             <div>{row.ca}</div>
                             <div>{row.ex}</div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
        <Cursor x={cursorX} y={cursorY} clicked={clicked} />
      </PlatformMockShell>
    </AbsoluteFill>
  );
};
