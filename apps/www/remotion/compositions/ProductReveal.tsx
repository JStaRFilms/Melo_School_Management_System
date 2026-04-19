import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { AdminOverviewScene } from '../scenes/AdminOverviewScene';
import { AcademicScene } from '../scenes/AcademicScene';
import { BillingScene } from '../scenes/BillingScene';
import { PortalScene } from '../scenes/PortalScene';

export const ProductReveal: React.FC = () => {
  return (
    <AbsoluteFill className="bg-slate-50 border-none font-sans text-slate-900">
      <Sequence from={0} durationInFrames={105}>
        <AdminOverviewScene />
      </Sequence>
      
      <Sequence from={105} durationInFrames={105}>
        <AcademicScene />
      </Sequence>

      <Sequence from={210} durationInFrames={105}>
        <BillingScene />
      </Sequence>

      <Sequence from={315} durationInFrames={105}>
        <PortalScene />
      </Sequence>
    </AbsoluteFill>
  );
};
