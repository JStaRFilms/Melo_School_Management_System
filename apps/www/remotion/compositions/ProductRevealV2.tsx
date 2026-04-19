import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { AdminCommandScene } from '../scenes/AdminCommandScene';
import { AcademicProofScene } from '../scenes/AcademicProofScene';
import { BillingClarityScene } from '../scenes/BillingClarityScene';
import { PortalTrustScene } from '../scenes/PortalTrustScene';

export const ProductRevealV2: React.FC = () => {
  const transitionDuration = 12;

  return (
    <AbsoluteFill className="bg-slate-50 border-none font-sans text-slate-900">
      <TransitionSeries name="Product reveal timeline">
        <TransitionSeries.Sequence name="Admin command" durationInFrames={96} premountFor={30}>
          <AdminCommandScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition 
          presentation={fade()} 
          timing={linearTiming({ durationInFrames: transitionDuration })} 
        />

        <TransitionSeries.Sequence name="Academic proof" durationInFrames={108} premountFor={30}>
          <AcademicProofScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition 
          presentation={fade()} 
          timing={linearTiming({ durationInFrames: transitionDuration })} 
        />

        <TransitionSeries.Sequence name="Billing clarity" durationInFrames={90} premountFor={30}>
          <BillingClarityScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition 
          presentation={fade()} 
          timing={linearTiming({ durationInFrames: transitionDuration })} 
        />

        <TransitionSeries.Sequence name="Portal trust" durationInFrames={84} premountFor={30}>
          <PortalTrustScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
