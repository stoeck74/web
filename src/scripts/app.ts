/**
 * Point d'entrée JS global — exécuté une seule fois (le ClientRouter
 * ne recharge pas les modules entre deux pages).
 *
 * Cycle d'une navigation :
 *   clic → astro:before-preparation  → animation de SORTIE + fetch de la page en parallèle
 *        → astro:before-swap         → la nouvelle page est préparée masquée
 *        → (swap du DOM)
 *        → astro:after-swap          → Lenis recréé
 *        → astro:page-load           → animation d'ENTRÉE + JS de la page
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initPage, destroyPage } from './pages';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const getPage = (root: Document = document) =>
  root.querySelector<HTMLElement>('[data-page]');

/* ---------------------------------------------------------------
   Lenis
   Recréé à chaque page : le router réécrit les attributs de <html>
   (donc les classes de Lenis) et gère lui-même la position de scroll
   (haut de page, ou position restaurée en arrière/avant).
---------------------------------------------------------------- */
let lenis: Lenis | null = null;
const raf = (time: number) => lenis?.raf(time * 1000);

function startLenis() {
  if (reducedMotion.matches) return;
  lenis = new Lenis({ lerp: 0.1, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
}

function stopLenis() {
  lenis?.destroy();
  lenis = null;
}

gsap.ticker.add(raf);
gsap.ticker.lagSmoothing(0);

/* ---------------------------------------------------------------
   Animations
---------------------------------------------------------------- */
let isFirstLoad = true;

function leave(): Promise<void> {
  const page = getPage();
  if (!page || reducedMotion.matches) return Promise.resolve();
  lenis?.stop();
  return new Promise((resolve) => {
    gsap.to(page, {
      autoAlpha: 0,
      y: -24,
      duration: 0.45,
      ease: 'power2.in',
      onComplete: resolve,
    });
  });
}

function enter() {
  const page = getPage();
  if (!page) return;
  if (reducedMotion.matches) {
    gsap.set(page, { autoAlpha: 1, y: 0 });
    return;
  }
  gsap.fromTo(
    page,
    { autoAlpha: 0, y: isFirstLoad ? 0 : 32 },
    {
      autoAlpha: 1,
      y: 0,
      duration: isFirstLoad ? 0.8 : 0.7,
      ease: 'expo.out',
      clearProps: 'transform',
    },
  );
}

/* ---------------------------------------------------------------
   Navigation active (le header est persisté, donc pas re-rendu)
---------------------------------------------------------------- */
function updateNav() {
  const path = location.pathname.replace(/\/?$/, '/');
  document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]').forEach((a) => {
    const href = new URL(a.href).pathname.replace(/\/?$/, '/');
    if (href === path) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ---------------------------------------------------------------
   Événements du router
---------------------------------------------------------------- */
document.addEventListener('astro:before-preparation', (event) => {
  // Même page (ancre, clic sur le lien courant) : pas d'animation
  if (event.from.pathname === event.to.pathname) return;

  const originalLoader = event.loader;
  event.loader = async () => {
    // La sortie et le chargement tournent en parallèle :
    // on attend le plus long des deux, jamais la somme.
    await Promise.all([leave(), originalLoader()]);
  };
});

document.addEventListener('astro:before-swap', (event) => {
  destroyPage();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  // La nouvelle page arrive masquée → pas de flash avant l'entrée
  const next = getPage(event.newDocument);
  if (next && !reducedMotion.matches) next.style.opacity = '0';
});

document.addEventListener('astro:after-swap', () => {
  stopLenis();
  startLenis();
});

document.addEventListener('astro:page-load', () => {
  if (isFirstLoad) startLenis();
  updateNav();
  enter();
  const page = getPage();
  if (page) initPage(page.dataset.namespace ?? '', page);
  ScrollTrigger.refresh();
  isFirstLoad = false;
});
