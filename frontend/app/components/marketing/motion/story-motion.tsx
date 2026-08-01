"use client";

import { gsap, useGSAP } from "@/app/lib/motion/gsap-client";
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
      if (!allowMotion || window.innerWidth < 1000) return;

      const workbench = document.querySelector<HTMLElement>(
        "[data-eligibility-pipeline]",
      );
      if (!workbench) return;

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

      return () => setWillChange(animated, false);
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
