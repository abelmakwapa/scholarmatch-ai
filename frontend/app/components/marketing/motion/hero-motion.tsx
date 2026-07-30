"use client";

import { gsap, ScrollTrigger, useGSAP } from "@/app/lib/motion/gsap-client";
import {
  gsapEasings,
  motionDistances,
  motionDurations,
  motionStaggers,
} from "@/app/lib/motion/tokens";
import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

export function HeroMotion() {
  const { allowMotion, reduceMotion } = useMotionPolicy();

  useGSAP(
    () => {
      const scope = document.querySelector<HTMLElement>("[data-hero-motion]");
      if (!scope || !allowMotion) return;

      const profile = scope.querySelector(".hero-matcher__profile");
      const result = scope.querySelector(".hero-matcher__result");
      const rail = scope.querySelector<HTMLElement>(".hero-matcher__rail");
      const railLine = scope.querySelector(".hero-matcher__rail > span");
      const marker = scope.querySelector(".hero-matcher__rail > i");
      const facts = scope.querySelectorAll(".hero-matcher__facts span");
      const animated = [profile, result, railLine, marker, ...facts].filter(
        Boolean,
      );
      if (!profile || !result || !rail || !railLine || !marker) return;

      const media = gsap.matchMedia();
      const createTimeline = (vertical: boolean) => {
        const travel = () =>
          Math.max(0, (vertical ? rail.clientHeight : rail.clientWidth) - 34);
        const activate = () =>
          gsap.set(animated, { willChange: "transform,opacity" });
        const deactivate = () =>
          gsap.set(animated, { clearProps: "willChange" });

        const timeline = gsap.timeline({
          paused: true,
          repeat: -1,
          repeatDelay: motionDurations.standard,
          onRepeat: activate,
        });
        timeline
          .from(profile, {
            autoAlpha: 0.62,
            duration: motionDurations.reveal,
            ease: gsapEasings.entrance,
            immediateRender: false,
            x: vertical ? 0 : -motionDistances.medium,
            y: vertical ? -motionDistances.medium : 0,
          })
          .from(
            result,
            {
              autoAlpha: 0.62,
              duration: motionDurations.reveal,
              ease: gsapEasings.entrance,
              immediateRender: false,
              x: vertical ? 0 : motionDistances.medium,
              y: vertical ? motionDistances.medium : 0,
            },
            `<${motionStaggers.story}`,
          )
          .from(
            facts,
            {
              autoAlpha: 0,
              duration: motionDurations.standard,
              ease: gsapEasings.entrance,
              immediateRender: false,
              stagger: motionStaggers.tight,
              y: motionDistances.small,
            },
            "<",
          )
          .fromTo(railLine, vertical ? { scaleY: 0 } : { scaleX: 0 }, {
            duration: motionDurations.reveal,
            ease: gsapEasings.standard,
            immediateRender: false,
            ...(vertical ? { scaleY: 1 } : { scaleX: 1 }),
            transformOrigin: vertical ? "center top" : "left center",
          })
          .to(marker, {
            duration: motionDurations.story,
            ease: gsapEasings.standard,
            x: vertical ? 0 : travel,
            y: vertical ? travel : 0,
          })
          .to(result, {
            duration: motionDurations.standard,
            ease: gsapEasings.entrance,
            repeat: 1,
            scale: 1.025,
            yoyo: true,
          });

        const trigger = ScrollTrigger.create({
          end: "bottom top",
          id: `scholarmatch-hero-${vertical ? "mobile" : "desktop"}`,
          onEnter: () => {
            activate();
            timeline.play();
          },
          onEnterBack: () => {
            activate();
            timeline.play();
          },
          onLeave: () => {
            timeline.pause();
            deactivate();
          },
          onLeaveBack: () => {
            timeline.pause();
            deactivate();
          },
          start: "top bottom",
          trigger: scope,
        });

        if (ScrollTrigger.isInViewport(scope, 0.05)) {
          activate();
          timeline.play();
        }

        return () => {
          trigger.kill();
          timeline.revert();
          deactivate();
        };
      };

      media.add("(min-width: 701px)", () => createTimeline(false));
      media.add("(max-width: 700px)", () => createTimeline(true));
      return () => media.revert();
    },
    { dependencies: [allowMotion], revertOnUpdate: true },
  );

  return (
    <span
      aria-hidden="true"
      data-motion={reduceMotion ? "reduced" : "full"}
      data-testid="hero-motion-runtime"
      hidden
    />
  );
}
