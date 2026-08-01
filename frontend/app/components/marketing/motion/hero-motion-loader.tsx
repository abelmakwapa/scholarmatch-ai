"use client";

import dynamic from "next/dynamic";

const HeroMotion = dynamic(
  () => import("./hero-motion").then((module) => module.HeroMotion),
  { ssr: false },
);

type HeroMotionLoaderProps = {
  animationKey: string;
  onComplete: () => void;
  playing: boolean;
};

export function HeroMotionLoader(props: HeroMotionLoaderProps) {
  return <HeroMotion {...props} />;
}
