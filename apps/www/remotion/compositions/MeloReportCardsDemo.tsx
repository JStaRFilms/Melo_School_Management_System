import React, { RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { MousePointer2, Sparkles } from "lucide-react";
import { VideoSafeWorkspaceNavbar } from "../components/VideoSafeWorkspaceNavbar";
import { MeloReportCardRouteView, MeloScoreEntryRouteView } from "../components/MeloRealRouteViews";
import { mockAminaReportCard } from "../data/mockAminaReportCard";
import { meloIds } from "../data/meloScoreEntryDemo";

const FPS = 30;
const SCENE = {
  hook: { from: 0, duration: 3 * FPS },
  score: { from: 3 * FPS, duration: 12 * FPS },
  report: { from: 15 * FPS, duration: 7 * FPS },
  cta: { from: 22 * FPS, duration: 3 * FPS },
};

type VideoAction = {
  id: string;
  label: string;
  target: { frame: number; targetId: string; x: number; y: number };
  downFrame: number;
  upFrame: number;
  commitFrame: number;
};

const actions: VideoAction[] = [
  {
    id: "select-class-subject",
    label: "Select Primary 5 Gold Mathematics",
    target: { frame: 104, targetId: "score-entry-class-selector", x: 506, y: 386 },
    downFrame: 104,
    upFrame: 112,
    commitFrame: 120,
  },
  {
    id: "enter-amina-exam-score",
    label: "Enter 42 for Amina Bello",
    target: { frame: 168, targetId: `score-${meloIds.amina}-examRawScore`, x: 1096, y: 460 },
    downFrame: 168,
    upFrame: 176,
    commitFrame: 222,
  },
  {
    id: "preview-report-card",
    label: "Preview Report Card",
    target: { frame: 405, targetId: `preview-report-card-${meloIds.amina}`, x: 724, y: 464 },
    downFrame: 405,
    upFrame: 414,
    commitFrame: 450,
  },
];

type MeloReportCardsDemoProps = {
  debugTargets?: boolean;
};

export const MeloReportCardsDemo: React.FC<MeloReportCardsDemoProps> = ({ debugTargets = false }) => {
  return (
    <AbsoluteFill className="overflow-hidden bg-slate-50 font-sans text-slate-950">
      <Sequence from={SCENE.hook.from} durationInFrames={SCENE.hook.duration}>
        <HookCard />
      </Sequence>
      <Sequence from={SCENE.score.from} durationInFrames={SCENE.score.duration}>
        <ScoreSheetScene debugTargets={debugTargets} />
      </Sequence>
      <Sequence from={SCENE.report.from} durationInFrames={SCENE.report.duration}>
        <ReportCardPreviewScene debugTargets={debugTargets} />
      </Sequence>
      <Sequence from={SCENE.cta.from} durationInFrames={SCENE.cta.duration}>
        <CtaScene />
      </Sequence>
    </AbsoluteFill>
  );
};

function HookCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade and scale for the overall hook card container
  const opacity = fade(frame, 0, 14) * (1 - fade(frame, 74, 90));
  const scale = interpolate(frame, [0, 42, 90], [0.96, 1, 1.02], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Animated background grid scroll
  const gridScroll = interpolate(frame, [0, 90], [0, -44], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Background animated color blobs
  const blob1X = interpolate(frame, [0, 90], [-60, 60]);
  const blob1Y = interpolate(frame, [0, 90], [-30, 30]);
  const blob2X = interpolate(frame, [0, 90], [60, -60]);
  const blob2Y = interpolate(frame, [0, 90], [30, -30]);

  // Card rotating border angle
  const angle = interpolate(frame, [0, 90], [0, 360], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulse animation for Sparkles icon
  const sparkleScale = 1 + Math.sin(frame * 0.15) * 0.15;

  // Staggered word animation
  const headlineText = "Now that I have you here… watch class scores become report cards in Melo.";
  const words = headlineText.split(" ");

  // Floating Score Badge Animation (Left)
  const leftBadgeSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 15, stiffness: 90 },
  });
  const leftBadgeTranslateX = interpolate(leftBadgeSpring, [0, 1], [-40, 0]);
  const leftBadgeOpacity = leftBadgeSpring;
  const leftBadgeFloat = Math.sin(frame * 0.08) * 8;

  // Floating Grade Badge Animation (Right)
  const rightBadgeSpring = spring({
    frame: frame - 25,
    fps,
    config: { damping: 15, stiffness: 90 },
  });
  const rightBadgeTranslateX = interpolate(rightBadgeSpring, [0, 1], [40, 0]);
  const rightBadgeOpacity = rightBadgeSpring;
  const rightBadgeFloat = Math.cos(frame * 0.08) * 8;

  return (
    <AbsoluteFill className="items-center justify-center bg-[#070a12] px-20 overflow-hidden" style={{ opacity }}>
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(234,179,8,0.26),transparent_34%),radial-gradient(circle_at_75%_30%,rgba(59,130,246,0.18),transparent_32%),linear-gradient(135deg,#070a12,#111827_45%,#0f172a)]" />

      {/* Animated blurred background blobs */}
      <div
        className="absolute rounded-full bg-amber-500/8 blur-[120px] h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          left: `calc(25% + ${blob1X}px)`,
          top: `calc(20% + ${blob1Y}px)`,
        }}
      />
      <div
        className="absolute rounded-full bg-blue-500/8 blur-[120px] h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          left: `calc(75% + ${blob2X}px)`,
          top: `calc(35% + ${blob2Y}px)`,
        }}
      />

      {/* Scrolling Grid overlay */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          transform: `translateY(${gridScroll}px)`,
        }}
      />

      {/* Outer Card with Rotating Conic Border */}
      <div
        className="relative max-w-4xl p-[1.5px] rounded-[40px] shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
        style={{
          backgroundImage: `conic-gradient(from ${angle}deg, rgba(234,179,8,0.5) 0deg, rgba(59,130,246,0.4) 120deg, rgba(255,255,255,0.12) 240deg, rgba(234,179,8,0.5) 360deg)`,
          transform: `scale(${scale})`,
        }}
      >
        {/* Inner Card (Glassmorphic) */}
        <div className="relative rounded-[38.5px] bg-[#070a12]/92 p-12 backdrop-blur-3xl flex flex-col items-center text-center overflow-hidden">
          {/* Subtle inside gradient highlight */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(234,179,8,0.04),transparent_60%)] pointer-events-none" />

          {/* Headline with Staggered Word Reveals */}
          <h1 className="text-balance text-6xl font-black leading-[1.05] tracking-[-0.05em] text-white flex flex-wrap justify-center max-w-3xl">
            {words.map((word, idx) => {
              const wordSpring = spring({
                frame: frame - idx * 2.2,
                fps,
                config: { damping: 14, stiffness: 100 },
              });
              const wordTranslateY = interpolate(wordSpring, [0, 1], [24, 0]);
              const wordOpacity = interpolate(wordSpring, [0, 0.4], [0, 1]);
              const wordScale = interpolate(wordSpring, [0, 1], [0.85, 1]);

              const isMelo = word.replace(/[.,…!]/g, "").toLowerCase() === "melo";

              if (isMelo) {
                return (
                  <span
                    key={idx}
                    className="inline-block mr-[0.25em] last:mr-0 bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400 bg-clip-text text-transparent font-black drop-shadow-[0_2px_10px_rgba(245,158,11,0.3)]"
                    style={{
                      opacity: wordOpacity,
                      transform: `translateY(${wordTranslateY}px) scale(${wordScale})`,
                    }}
                  >
                    {word}
                  </span>
                );
              }

              return (
                <span
                  key={idx}
                  className="inline-block mr-[0.25em] last:mr-0 text-white"
                  style={{
                    opacity: wordOpacity,
                    transform: `translateY(${wordTranslateY}px) scale(${wordScale})`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </h1>
        </div>

        {/* Floating Score Badge (Left) */}
        <div
          className="absolute top-[20%] pointer-events-none rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl backdrop-blur-xl flex items-center gap-3"
          style={{
            right: "calc(100% + 32px)",
            opacity: leftBadgeOpacity,
            transform: `translateX(${leftBadgeTranslateX}px) translateY(${leftBadgeFloat}px)`,
            zIndex: 10,
          }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 font-bold text-sm">
            95
          </div>
          <div className="flex flex-col pr-2 text-left">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Mathematics</span>
            <span className="text-xs font-black text-white">Score Entered</span>
          </div>
        </div>

        {/* Floating Grade Badge (Right) */}
        <div
          className="absolute bottom-[20%] pointer-events-none rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl backdrop-blur-xl flex items-center gap-3"
          style={{
            left: "calc(100% + 32px)",
            opacity: rightBadgeOpacity,
            transform: `translateX(${rightBadgeTranslateX}px) translateY(${rightBadgeFloat}px)`,
            zIndex: 10,
          }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-black text-lg">
            A
          </div>
          <div className="flex flex-col pr-2 text-left">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Report Card</span>
            <span className="text-xs font-black text-white">Excellent Remark</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ScoreSheetScene({ debugTargets }: { debugTargets: boolean }) {
  const frame = useCurrentFrame();
  const rootRef = useRef<HTMLDivElement>(null);
  const absoluteFrame = frame + SCENE.score.from;
  const opacity = fade(frame, 0, 16) * (1 - fade(frame, SCENE.score.duration - 16, SCENE.score.duration));
  const typedScore = getTypedScore(absoluteFrame);
  const scoreValue = typedScore === "42" ? 42 : null;
  const ready = absoluteFrame >= actions[1].commitFrame;
  const previewLinkVisible = absoluteFrame >= actions[2].downFrame - 42;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div ref={rootRef} data-video-coordinate-root className="absolute inset-0">
        <VideoSafeWorkspaceNavbar
          workspace="admin"
          currentPath="/assessments/results/entry"
          userName="Academic Registrar"
          userRole="Admin"
        >
          <MeloScoreEntryRouteView scoreValue={scoreValue} ready={ready} previewLinkVisible={previewLinkVisible} />
        </VideoSafeWorkspaceNavbar>
        <MeasuredCursor rootRef={rootRef} absoluteFrame={absoluteFrame} debugTargets={debugTargets} />
      </div>
    </AbsoluteFill>
  );
}

function ReportCardPreviewScene({ debugTargets }: { debugTargets: boolean }) {
  const frame = useCurrentFrame();
  const rootRef = useRef<HTMLDivElement>(null);
  const opacity = fade(frame, 0, 16) * (1 - fade(frame, SCENE.report.duration - 14, SCENE.report.duration));
  const highlightOpacity = fade(frame, 34, 52) * (1 - fade(frame, 174, 204));

  return (
    <AbsoluteFill style={{ opacity }}>
      <div ref={rootRef} data-video-coordinate-root className="absolute inset-0">
        <VideoSafeWorkspaceNavbar
          workspace="admin"
          currentPath="/assessments/report-cards"
          userName="Academic Registrar"
          userRole="Admin"
        >
          <MeloReportCardRouteView reportCard={mockAminaReportCard} />
        </VideoSafeWorkspaceNavbar>
        <TargetHighlight
          rootRef={rootRef}
          targetId="report-card-row-maths"
          opacity={highlightOpacity}
          fallback={{ x: 746, y: 458, width: 448, height: 18 }}
          debugTargets={debugTargets}
        />
      </div>
    </AbsoluteFill>
  );
}

function CtaScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 18);
  const logoOpacity = fade(frame, 34, 64);
  const lift = interpolate(frame, [0, 46], [22, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="items-center justify-center overflow-hidden bg-[#070a12]" style={{ opacity }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(234,179,8,0.28),transparent_35%),linear-gradient(180deg,#0f172a,#070a12)]" />
      <div className="relative flex flex-col items-center text-center" style={{ transform: `translateY(${lift}px)` }}>
        <Img
          src={staticFile("melo-favicon.png")}
          className="mb-7 h-20 w-20 rounded-[24px] shadow-2xl shadow-amber-500/20"
          style={{ opacity: logoOpacity }}
        />
        <h2 className="text-6xl font-black tracking-[-0.07em] text-white">Scores in. Report cards ready.</h2>
        <button className="mt-9 rounded-2xl bg-white px-8 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-2xl shadow-black/25">
          Book a demo
        </button>
      </div>
    </AbsoluteFill>
  );
}

type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };

function MeasuredCursor({
  rootRef,
  absoluteFrame,
  debugTargets,
}: {
  rootRef: RefObject<HTMLElement>;
  absoluteFrame: number;
  debugTargets: boolean;
}) {
  const targetIds = useMemo(() => actions.map((action) => action.target.targetId), []);
  const targets = useMeasuredTargets(rootRef, targetIds);

  if (absoluteFrame < 92 || absoluteFrame > 432) return null;

  const point = getCursorPoint(absoluteFrame, targets);
  const clicked = actions.some((action) => absoluteFrame >= action.downFrame && absoluteFrame <= action.upFrame);

  return (
    <>
      {debugTargets ? <DebugTargetOverlay targets={targets} activePoint={point} /> : null}
      <div className="pointer-events-none absolute z-[100]" style={{ left: point.x, top: point.y, transform: `scale(${clicked ? 0.82 : 1})` }}>
        <MousePointer2 className="h-7 w-7 fill-white text-slate-950 drop-shadow-lg" />
        {clicked ? <div className="absolute -left-2 -top-2 h-10 w-10 rounded-full border-2 border-blue-400 bg-blue-400/15" /> : null}
      </div>
    </>
  );
}

function TargetHighlight({
  rootRef,
  targetId,
  opacity,
  fallback,
  debugTargets,
}: {
  rootRef: RefObject<HTMLElement>;
  targetId: string;
  opacity: number;
  fallback: Box;
  debugTargets: boolean;
}) {
  const targetIds = useMemo(() => [targetId], [targetId]);
  const targets = useMeasuredTargets(rootRef, targetIds);
  const measured = targets[targetId];
  const box = measured
    ? {
        ...measured,
        y: measured.y,
        width: fallback.width,
        height: Math.max(measured.height, fallback.height),
      }
    : fallback;

  return (
    <>
      {debugTargets ? <DebugTargetOverlay targets={targets} /> : null}
      <div
        className="pointer-events-none absolute inset-0 bg-slate-950"
        style={{ opacity: opacity * 0.12, zIndex: 70 }}
      />
      <div
        className="pointer-events-none absolute rounded-lg border-4 border-amber-400 bg-amber-200/10 shadow-[0_0_34px_rgba(251,191,36,0.55)]"
        style={{
          left: box.x - 4,
          top: box.y - 4,
          width: box.width + 8,
          height: box.height + 8,
          opacity,
          zIndex: 80,
        }}
      />
    </>
  );
}

function DebugTargetOverlay({ targets, activePoint }: { targets: Record<string, Box>; activePoint?: Point }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[120]">
      {Object.entries(targets).map(([targetId, box]) => (
        <div
          key={targetId}
          className="absolute rounded border-2 border-fuchsia-500 bg-fuchsia-500/10"
          style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
        >
          <span className="absolute -top-5 left-0 rounded bg-fuchsia-600 px-1.5 py-0.5 text-[9px] font-black text-white">
            {targetId}
          </span>
        </div>
      ))}
      {activePoint ? (
        <div
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300 bg-cyan-400/40"
          style={{ left: activePoint.x, top: activePoint.y }}
        />
      ) : null}
    </div>
  );
}

function useMeasuredTargets(rootRef: RefObject<HTMLElement>, targetIds: string[]) {
  const frame = useCurrentFrame();
  const { width: compositionWidth, height: compositionHeight } = useVideoConfig();
  const [targets, setTargets] = useState<Record<string, Box>>({});
  const [delayHandle] = useState(() => delayRender("Measuring semantic video targets"));
  const [hasContinued, setHasContinued] = useState(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      if (!hasContinued) {
        continueRender(delayHandle);
        setHasContinued(true);
      }
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const scaleX = rootRect.width / compositionWidth;
    const scaleY = rootRect.height / compositionHeight;
    const next: Record<string, Box> = {};

    for (const targetId of targetIds) {
      const target = root.querySelector(`[data-video-target="${targetId}"]`);
      if (!(target instanceof HTMLElement)) continue;

      const targetRect = target.getBoundingClientRect();
      next[targetId] = {
        x: (targetRect.left - rootRect.left) / scaleX,
        y: (targetRect.top - rootRect.top) / scaleY,
        width: targetRect.width / scaleX,
        height: targetRect.height / scaleY,
      };
    }

    setTargets(next);
    if (!hasContinued) {
      continueRender(delayHandle);
      setHasContinued(true);
    }
  }, [compositionHeight, compositionWidth, delayHandle, frame, hasContinued, rootRef, targetIds]);

  return targets;
}

function getCursorPoint(frame: number, targets: Record<string, Box>): Point {
  const points = [
    { frame: 92, point: { x: 118, y: 628 } },
    ...actions.flatMap((action) => {
      const point = getActionPoint(action, targets);
      return [
        { frame: action.downFrame, point },
        { frame: action.upFrame, point },
        { frame: action.commitFrame, point },
      ];
    }),
    { frame: 432, point: getActionPoint(actions[2], targets) },
  ].sort((a, b) => a.frame - b.frame);

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (frame >= start.frame && frame <= end.frame) {
      return {
        x: interpolate(frame, [start.frame, end.frame], [start.point.x, end.point.x], {
          easing: Easing.inOut(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        y: interpolate(frame, [start.frame, end.frame], [start.point.y, end.point.y], {
          easing: Easing.inOut(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      };
    }
  }

  return points[points.length - 1].point;
}

function getActionPoint(action: VideoAction, targets: Record<string, Box>): Point {
  const box = targets[action.target.targetId];
  if (!box) return { x: action.target.x, y: action.target.y };
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function getTypedScore(frame: number) {
  if (frame < actions[1].upFrame + 10) return "";
  if (frame < actions[1].upFrame + 24) return "4";
  return "42";
}

function fade(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
