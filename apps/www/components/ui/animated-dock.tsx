"use client" 

import * as React from "react"
import { useRef } from "react";
import {
  MotionValue,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
 
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

import Link from "next/link";
 
const cn = (...args: any[]) => twMerge(clsx(args));
 
export interface AnimatedDockProps {
  className?: string;
  items: DockItemData[];
}
 
export interface DockItemData {
  link: string;
  Icon: React.ReactNode;
  label?: string;
  target?: string;
}
 
export const AnimatedDock = ({ className, items }: AnimatedDockProps) => {
  const mouseX = useMotionValue(Infinity);
 
  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        "mx-auto flex h-12 items-center gap-2 rounded-[1.15rem] border border-white/10 bg-black/30 px-2.5 py-1.5 backdrop-blur-2xl shadow-[0_18px_48px_rgba(0,0,0,0.28)] sm:h-14 sm:gap-2.5 sm:rounded-[1.35rem] sm:px-3 sm:py-2",
        className,
      )}
    >
      {items.map((item, index) => (
        <DockItem key={index} mouseX={mouseX} item={item}>
          <Link
            href={item.link}
            target={item.target}
            className="grow flex flex-col items-center justify-center w-full h-full text-white"
          >
            {item.Icon}
          </Link>
        </DockItem>
      ))}
    </motion.div>
  );
};
 
interface DockItemProps {
  mouseX: MotionValue<number>;
  children: React.ReactNode;
  item: DockItemData;
}
 
export const DockItem = ({ mouseX, children, item }: DockItemProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-180, 0, 180], [40, 52, 40]);
  const width = useSpring(widthSync, {
    mass: 0.2,
    stiffness: 260,
    damping: 24,
  });

  const iconScale = useTransform(width, [40, 52], [1, 1.1]);
  const iconSpring = useSpring(iconScale, {
    mass: 0.2,
    stiffness: 260,
    damping: 24,
  });

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      title={item.label}
      className="relative flex aspect-square w-10 items-center justify-center rounded-full bg-white/[0.045] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(0,0,0,0.16)] transition-colors duration-200 group hover:bg-white/[0.08] sm:w-11"
    >
      <motion.div
        style={{ scale: iconSpring }}
        className="flex items-center justify-center w-full h-full grow"
      >
        {children}
      </motion.div>
      {item.label && (
         <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/85 rounded-md hidden group-hover:block text-[10px] text-white whitespace-nowrap pointer-events-none">
           {item.label}
         </div>
      )}
    </motion.div>
  );
};
