"use client";

import { gsap, ScrollTrigger, useGSAP } from "@/app/lib/motion/gsap-client";
import {
  gsapEasings,
  motionDistances,
  motionDurations,
  motionStaggers,
} from "@/app/lib/motion/tokens";
import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

function setWillChange(targets: Element[], active: boolean) {
  gsap.set(
    targets,
    active ? { willChange: "transform,opacity" } : { clearProps: "willChange" },
  );
}

export function StoryMotion() {
  const { allowMotion, reduceMotion } = useMotionPolicy();

  useGSAP(
    () => {
      if (!allowMotion) return;

      const workbench = document.querySelector<HTMLElement>(
        "[data-eligibility-pipeline]",
      );
      const marquee = document.querySelector<HTMLElement>(
        "[data-proof-motion]",
      );
      const featureSection = document.querySelector<HTMLElement>(
        "[data-feature-story]",
      );

      if (workbench) {
        const panels = Array.from(
          workbench.querySelectorAll<HTMLElement>(".workbench-panel"),
        );
        const rules = Array.from(
          workbench.querySelectorAll<HTMLElement>(".rule-path__item"),
        );
        const animated = [...panels, ...rules];
        const timeline = gsap.timeline({
          defaults: { ease: gsapEasings.entrance },
          scrollTrigger: {
            end: "bottom 58%",
            id: "scholarmatch-eligibility-pipeline",
            onToggle: (self) => setWillChange(animated, self.isActive),
            scrub: 0.6,
            start: "top 82%",
            trigger: workbench,
          },
        });
        timeline
          .from(panels[0], {
            autoAlpha: 0.58,
            duration: motionDurations.story,
            immediateRender: false,
            y: motionDistances.large,
          })
          .from(
            panels[1],
            {
              autoAlpha: 0.58,
              duration: motionDurations.story,
              immediateRender: false,
              y: motionDistances.large,
            },
            ">-0.3",
          )
          .from(
            rules,
            {
              autoAlpha: 0.5,
              duration: motionDurations.reveal,
              immediateRender: false,
              stagger: motionStaggers.standard,
              x: -motionDistances.medium,
            },
            "<0.2",
          )
          .from(
            panels[2],
            {
              autoAlpha: 0.58,
              duration: motionDurations.story,
              immediateRender: false,
              y: motionDistances.large,
            },
            ">-0.2",
          );
      }

      if (marquee) {
        const track = marquee.querySelector<HTMLElement>(
          ".category-marquee__track",
        );
        if (track) {
          const tween = gsap.to(track, {
            duration: 34,
            ease: "none",
            paused: true,
            repeat: -1,
            xPercent: -50,
          });
          ScrollTrigger.create({
            end: "bottom top",
            id: "scholarmatch-proof-band",
            onEnter: () => {
              gsap.set(track, { willChange: "transform" });
              tween.play();
            },
            onEnterBack: () => {
              gsap.set(track, { willChange: "transform" });
              tween.play();
            },
            onLeave: () => {
              tween.pause();
              gsap.set(track, { clearProps: "willChange" });
            },
            onLeaveBack: () => {
              tween.pause();
              gsap.set(track, { clearProps: "willChange" });
            },
            start: "top bottom",
            trigger: marquee,
          });
        }
      }

      if (featureSection) {
        const cards = Array.from(
          featureSection.querySelectorAll<HTMLElement>(".feature-card"),
        );
        gsap.fromTo(
          cards,
          { autoAlpha: 0.62, y: motionDistances.large },
          {
            autoAlpha: 1,
            duration: motionDurations.reveal,
            ease: gsapEasings.entrance,
            onComplete: () => setWillChange(cards, false),
            onReverseComplete: () => setWillChange(cards, false),
            scrollTrigger: {
              end: "bottom 25%",
              id: "scholarmatch-feature-story",
              onEnter: () => setWillChange(cards, true),
              onEnterBack: () => setWillChange(cards, true),
              start: "top 78%",
              toggleActions: "play none none reverse",
              trigger: featureSection,
            },
            stagger: motionStaggers.story,
            y: 0,
          },
        );
      }

      return () => {
        const activeTargets = Array.from(
          document.querySelectorAll<Element>(
            "[data-story-motion-root] .workbench-panel, [data-story-motion-root] .rule-path__item, [data-proof-motion] .category-marquee__track, [data-feature-story] .feature-card",
          ),
        );
        setWillChange(activeTargets, false);
      };
    },
    { dependencies: [allowMotion], revertOnUpdate: true },
  );

  return (
    <span
      aria-hidden="true"
      data-motion={reduceMotion ? "reduced" : "full"}
      data-testid="story-motion-runtime"
      hidden
    />
  );
}
