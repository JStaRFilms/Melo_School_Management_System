"use client";

import { motion,MotionValue,useScroll,useTransform } from "framer-motion";
import React,{ useRef } from "react";

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
    return isMobile ? [0.96, 1] : [1.05, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 1], [isMobile ? 8 : 20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 1], [0, isMobile ? -40 : -100]);

  return (
    <section 
      ref={containerRef} 
      className="relative min-h-[100svh] md:min-h-[120vh] flex items-center justify-center py-16 sm:py-20 bg-melo-paper overflow-hidden"
    >
      <div
        className="py-8 sm:py-10 md:py-20 w-full relative"
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
      className="max-w-4xl mx-auto text-center px-4 mb-10 sm:mb-20"
    >
      <h2 className="font-serif text-[2.8rem] sm:text-6xl text-melo-ink leading-[0.95] sm:leading-tight tracking-tight max-w-[10ch] sm:max-w-none mx-auto">
        A platform as capable as <br className="hidden sm:block" /> your ambition demands.
      </h2>
      <p className="mt-4 sm:mt-6 text-melo-muted text-base sm:text-xl font-light max-w-[18rem] sm:max-w-none mx-auto">
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
      className="max-w-6xl mx-auto w-[92%] md:w-full border-8 border-melo-ink/5 p-2 md:p-4 bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden"
    >
      <div className="h-[54svh] min-h-[24rem] sm:h-[40vh] md:h-[60vh] lg:h-[70vh] w-full overflow-hidden rounded-[20px] sm:rounded-[24px] bg-stone-100 border border-melo-border/50">
        {children}
      </div>
    </motion.div>
  );
};

function PlatformUIPlaceholder() {
  return (
    <div className="w-full h-full flex flex-col bg-[#edf2f7] overflow-hidden relative group p-2 md:p-3">
      <video
        className="h-full w-auto max-w-none mx-auto rounded-2xl md:rounded-[24px] bg-white object-contain sm:h-full sm:w-full sm:max-w-full"
        autoPlay
        muted
        loop
        playsInline
        poster="/media/platform-reveal-poster.jpg"
      >
        <source src="/media/platform-reveal.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  )
}
