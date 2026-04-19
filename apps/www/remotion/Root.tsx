import React from 'react';
import { Composition, Still, registerRoot } from 'remotion';
import { ProductRevealV2 } from './compositions/ProductRevealV2';
import { UnifiedOperationsStill } from './stills/UnifiedOperationsStill';
import '../app/globals.css';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="PlatformReveal"
				component={ProductRevealV2}
				durationInFrames={342}
				fps={30}
				width={1280}
				height={720}
			/>
			<Still
				id="UnifiedOperationsStill"
				component={UnifiedOperationsStill}
				width={1600}
				height={900}
			/>
		</>
	);
};

registerRoot(RemotionRoot);
