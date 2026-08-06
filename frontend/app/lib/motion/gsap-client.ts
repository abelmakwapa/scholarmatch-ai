"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Client components reach this module only through `ssr: false` loaders or a
// post-mount dynamic import. Module evaluation remains the single registration
// point for both plugins and never runs during server rendering.
gsap.registerPlugin(useGSAP, ScrollTrigger);

export { gsap, ScrollTrigger, useGSAP };
