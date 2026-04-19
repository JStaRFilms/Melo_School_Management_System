"use client";

import React, { useRef } from "react";
import { useScroll, useTransform, motion, MotionValue } from "framer-motion";
import { Container } from "@/site-ui";

export function FramedReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.8, 0.9] : [1.05, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 0.4], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.4], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 0.4], [0, -100]);

  return (
    <section 
      ref={containerRef} 
      className="relative min-h-[100vh] md:min-h-[120vh] flex items-center justify-center py-20 bg-melo-paper overflow-hidden"
    >
      <div
        className="py-10 md:py-20 w-full relative"
        style={{
          perspective: "1000px",
        }}
      >
        <Header translate={translate} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          <PlatformUIPlaceholder />
        </Card>
      </div>
    </section>
  );
}

const Header = ({ translate }: { translate: MotionValue<number> }) => {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="max-w-4xl mx-auto text-center px-4 mb-20"
    >
      <h2 className="font-serif text-4xl sm:text-6xl text-melo-ink leading-tight tracking-tight">
        A platform as capable as <br className="hidden sm:block" /> your ambition demands.
      </h2>
      <p className="mt-6 text-melo-muted text-lg sm:text-xl font-light">
        The command center for every dimension of school life.
      </p>
    </motion.div>
  );
};

const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="max-w-6xl -mt-12 mx-auto w-[92%] md:w-full border-8 border-melo-ink/5 p-2 md:p-4 bg-white rounded-[40px] shadow-2xl overflow-hidden"
    >
      <div className="h-[40vh] md:h-[60vh] lg:h-[70vh] w-full overflow-hidden rounded-[24px] bg-stone-100 border border-melo-border/50">
        {children}
      </div>
    </motion.div>
  );
};

function PlatformUIPlaceholder() {
  return (
    <div className="w-full h-full flex flex-col bg-stone-50">
        {/* Top bar */}
        <div className="h-12 border-b border-melo-border/30 bg-white flex items-center px-6 gap-3">
             <div className="h-3 w-3 rounded-full bg-stone-200" />
             <div className="h-3 w-3 rounded-full bg-stone-200" />
             <div className="h-3 w-3 rounded-full bg-stone-200" />
             <div className="mx-auto h-5 w-64 rounded bg-stone-100" />
        </div>
        <div className="flex-1 flex overflow-hidden">
             {/* Sidebar */}
             <div className="w-56 border-r border-melo-border/30 bg-white p-5 flex flex-col gap-5">
                  <div className="h-8 w-full rounded-lg bg-stone-100" />
                  <div className="h-4 w-1/2 rounded bg-stone-100 mt-4" />
                  <div className="flex flex-col gap-2">
                      <div className="h-9 w-full rounded-md bg-melo-gold/5 border border-melo-gold/20" />
                      <div className="h-9 w-full rounded-md bg-stone-50" />
                      <div className="h-9 w-full rounded-md bg-stone-50" />
                  </div>
             </div>
             {/* Content */}
             <div className="flex-1 p-8 flex flex-col gap-8 overflow-hidden">
                  <div className="h-10 w-48 rounded-xl bg-stone-200" />
                  <div className="grid grid-cols-3 gap-6">
                       <div className="h-32 rounded-2xl bg-white border border-melo-border/40 shadow-sm" />
                       <div className="h-32 rounded-2xl bg-white border border-melo-border/40 shadow-sm" />
                       <div className="h-32 rounded-2xl bg-white border border-melo-border/40 shadow-sm" />
                  </div>
                  <div className="flex-1 rounded-2xl bg-white border border-melo-border/40 shadow-sm p-6 flex flex-col gap-4">
                       <div className="h-6 w-32 rounded bg-stone-100" />
                       <div className="flex-1 rounded-lg bg-stone-50" />
                  </div>
             </div>
        </div>
    </div>
  )
}
