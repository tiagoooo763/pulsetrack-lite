// Vanilla HTML + GSAP 3 + ScrollTrigger plugin.
// Example markup: <section class="reveal" data-reveal>...</section>
// Load gsap and ScrollTrigger before this file (or adapt these imports to npm).
// IMPORTANT: content is visible by default if JavaScript fails.
if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    document.querySelectorAll("[data-reveal]").forEach((element) => {
      gsap.fromTo(element, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: 0.65, ease: "power2.out",
        scrollTrigger: { trigger: element, start: "top 92%", once: true },
      });
    });
  }
}
