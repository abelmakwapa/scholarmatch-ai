"use client";

import dynamic from "next/dynamic";

const HeroMotion = dynamic(
  () => import("./hero-motion").then((module) => module.HeroMotion),
  { ssr: false },
);

export function HeroMotionLoader() {
  return <HeroMotion />;
}
