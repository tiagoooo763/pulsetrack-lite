"use client";

// React + GSAP. Install: npm install gsap @gsap/react
// Wrap page sections in <RevealOnScroll>...</RevealOnScroll>.
import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function RevealOnScroll({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.fromTo(el, { autoAlpha: 0, y: 24 }, {
      autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  }, { scope: root });

  return <div ref={root}>{children}</div>;
}
