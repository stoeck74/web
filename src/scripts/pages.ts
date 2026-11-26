/**
 * JS propre à chaque page, lancé selon data-namespace du <main>.
 * Chaque init peut renvoyer une fonction de nettoyage, appelée
 * avant de quitter la page (listeners, observers, timelines…).
 */
import { gsap } from 'gsap';

type Cleanup = () => void;
type PageInit = (root: HTMLElement) => Cleanup | void;

const pages: Record<string, PageInit> = {
  home(root) {
    const tl = gsap.from(root.querySelectorAll('[data-reveal]'), {
      y: 40,
      autoAlpha: 0,
      duration: 1,
      ease: 'expo.out',
      stagger: 0.08,
      delay: 0.15,
    });
    return () => tl.kill();
  },

  project(root) {
    const tl = gsap.from(root.querySelectorAll('[data-reveal]'), {
      y: 30,
      autoAlpha: 0,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.06,
      delay: 0.1,
    });
    return () => tl.kill();
  },
};

let cleanup: Cleanup | void;

export function initPage(namespace: string, root: HTMLElement) {
  cleanup = pages[namespace]?.(root);
}

export function destroyPage() {
  cleanup?.();
  cleanup = undefined;
}
