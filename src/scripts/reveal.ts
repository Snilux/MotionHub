import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Anima los elementos que coincidan con `selector` dentro de `trigger`
export const reveal = (
  trigger: string,
  selector: string,
  vars: gsap.TweenVars,
  start = "top 80%",
) => {
  const triggerEl = document.querySelector(trigger);
  const targets = triggerEl?.querySelectorAll(selector);
  if (!triggerEl || !targets?.length) return;

  gsap.from(targets, {
    scrollTrigger: {
      trigger: triggerEl,
      start,
      // Se anima al entrar desde abajo o desde arriba y se reinicia al salir
      toggleActions: "play reverse play reverse",
    },
    opacity: 0,
    duration: 1,
    ease: "power3.out",
    ...vars,
  });
};

// Divisor + título + subtítulo de una sección
export const revealSectionHeader = (section: string) => {
  reveal(section, ".divider", { opacity: 1, scaleX: 0, ease: "power2.out" });
  reveal(section, ".section-title", { y: 50 });
  reveal(section, ".section-subtitle", { y: 40, delay: 0.3 });
};
