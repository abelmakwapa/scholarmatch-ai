"use client";

import { useEffect, useRef } from "react";

import { gsap, ScrollTrigger, useGSAP } from "@/app/lib/motion/gsap-client";
import {
  gsapEasings,
  motionDistances,
  motionDurations,
  motionStaggers,
} from "@/app/lib/motion/tokens";
import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

type HeroMotionProps = {
  animationKey: string;
  onComplete: () => void;
  playing: boolean;
};

export function HeroMotion({
  animationKey,
  onComplete,
  playing,
}: HeroMotionProps) {
  const runtimeRef = useRef<HTMLSpanElement>(null);
  const timelineRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);
  const inViewportRef = useRef(true);
  const playingRef = useRef(playing);
  const completeRef = useRef(onComplete);
  const { allowMotion, reduceMotion } = useMotionPolicy();

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useGSAP(
    () => {
      const scope =
        runtimeRef.current?.closest<HTMLElement>("[data-hero-motion]");
      if (!scope || !allowMotion) return;

      const facts = Array.from(
        scope.querySelectorAll<HTMLElement>(".hero-matcher__fact-token"),
      );
      const gates = Array.from(
        scope.querySelectorAll<HTMLElement>(".hero-matcher__gate"),
      );
      const matches = Array.from(
        scope.querySelectorAll<HTMLElement>(".hero-matcher__match-card"),
      );
      const path = scope.querySelector<SVGPathElement>(
        ".hero-matcher__path-accent",
      );
      const animated: Element[] = [...facts, ...gates, ...matches];
      if (facts.length !== 3 || gates.length !== 3 || matches.length !== 3) {
        return;
      }

      const setActive = (active: boolean) => {
        gsap.set(
          animated,
          active
            ? { willChange: "transform,opacity" }
            : { clearProps: "willChange" },
        );
      };
      const gateOffset = (token: HTMLElement, index: number) => {
        const tokenRect = token.getBoundingClientRect();
        const gateRect = gates[index].getBoundingClientRect();
        return {
          x:
            gateRect.left +
            gateRect.width / 2 -
            (tokenRect.left + tokenRect.width / 2),
          y:
            gateRect.top +
            gateRect.height / 2 -
            (tokenRect.top + tokenRect.height / 2),
        };
      };

      const timeline = gsap.timeline({
        onComplete: () => {
          setActive(false);
          completeRef.current();
        },
        onStart: () => setActive(true),
        paused: true,
      });
      timelineRef.current = timeline;

      if (path) {
        timeline.from(path, {
          duration: motionDurations.story,
          ease: gsapEasings.standard,
          immediateRender: false,
          strokeDashoffset: 1,
        });
      }
      timeline
        .from(
          facts,
          {
            autoAlpha: 0.58,
            duration: motionDurations.standard,
            ease: gsapEasings.entrance,
            immediateRender: false,
            stagger: motionStaggers.tight,
            y: motionDistances.small,
          },
          path ? "<0.15" : 0,
        )
        .to(
          facts,
          {
            duration: motionDurations.story,
            ease: gsapEasings.standard,
            stagger: motionStaggers.story,
            x: (index, target: HTMLElement) => gateOffset(target, index).x,
            y: (index, target: HTMLElement) => gateOffset(target, index).y,
          },
          ">-0.05",
        )
        .from(
          gates,
          {
            autoAlpha: 0.58,
            duration: motionDurations.reveal,
            ease: gsapEasings.entrance,
            immediateRender: false,
            scale: 0.94,
            stagger: motionStaggers.story,
          },
          "<-0.35",
        )
        .to(facts, {
          autoAlpha: 0.18,
          duration: motionDurations.standard,
          ease: gsapEasings.exit,
        })
        .from(
          matches,
          {
            autoAlpha: 0.35,
            duration: motionDurations.reveal,
            ease: gsapEasings.entrance,
            immediateRender: false,
            stagger: motionStaggers.story,
            y: motionDistances.medium,
          },
          ">-0.05",
        )
        .to(
          facts,
          {
            autoAlpha: 1,
            duration: motionDurations.standard,
            ease: gsapEasings.entrance,
            stagger: motionStaggers.tight,
            x: 0,
            y: 0,
          },
          "<0.15",
        );

      const trigger = ScrollTrigger.create({
        end: "bottom top",
        id: "scholarmatch-hero-demo",
        onEnter: () => {
          inViewportRef.current = true;
          if (playingRef.current) timeline.play();
        },
        onEnterBack: () => {
          inViewportRef.current = true;
          if (playingRef.current) timeline.play();
        },
        onLeave: () => {
          inViewportRef.current = false;
          timeline.pause();
          setActive(false);
        },
        onLeaveBack: () => {
          inViewportRef.current = false;
          timeline.pause();
          setActive(false);
        },
        start: "top bottom",
        trigger: scope,
      });

      inViewportRef.current = ScrollTrigger.isInViewport(scope, 0.02);
      if (playingRef.current && inViewportRef.current) timeline.play();

      return () => {
        trigger.kill();
        timeline.revert();
        timelineRef.current = null;
        setActive(false);
      };
    },
    { dependencies: [allowMotion, animationKey], revertOnUpdate: true },
  );

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    if (playing && allowMotion && inViewportRef.current) timeline.play();
    else timeline.pause();
  }, [allowMotion, playing]);

  return (
    <span
      aria-hidden="true"
      data-animation-key={animationKey}
      data-motion={reduceMotion ? "reduced" : "full"}
      data-testid="hero-motion-runtime"
      hidden
      ref={runtimeRef}
    />
  );
}
