import React from 'react';
import { MousePointer2 } from 'lucide-react';

export const Cursor: React.FC<{
  x: number;
  y: number;
  clicked?: boolean;
}> = ({ x, y, clicked }) => {
  return (
    <div
      className="absolute pointer-events-none z-[100] transition-transform duration-100"
      style={{
        left: x,
        top: y,
        transform: `scale(${clicked ? 0.8 : 1})`,
      }}
    >
      <MousePointer2 className="h-6 w-6 text-slate-900 fill-white stroke-[2.5px] drop-shadow-md" />
      {clicked && (
        <div className="absolute top-0 left-0 h-6 w-6 rounded-full bg-blue-500/30 animate-ping" />
      )}
    </div>
  );
};
