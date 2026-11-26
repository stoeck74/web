/**
 * Séquence du loader, en une seule timeline GSAP (TextPlugin) :
 *   1. ...                        trois points, un par un
 *   2.                            effacés
 *   3. Cédric Stoecklin Studio    tapé façon machine à écrire
 *   4. CSS                        retour arrière au rythme de la frappe, une lettre
 *                                 par mot à chaque battement, espaces en dernier
 *   5. CSS glisse à la place du logo du header, la page apparaît,
 *      puis les accolades du header apparaissent en fondu : {CSS}
 *
 * Renvoie une promesse résolue au début de la sortie, pour que l'animation
 * d'entrée de la page démarre en même temps.
 */
import { gsap } from 'gsap';
import { TextPlugin } from 'gsap/TextPlugin';

gsap.registerPlugin(TextPlugin);

/** Mots tapés puis effacés jusqu'à leur initiale.
 *  Variante sans espaces : ['Cédric', 'Stoecklin', 'Studio'] → CédricStoecklinStudio → CSS */
const WORDS = ['Cédric ', 'Stoecklin ', 'Studio'];
const INTRO_KEY = 'css-intro-seen';

/** Vitesse globale : 1 = normal, 1.3 = plus rapide, 0.8 = plus lent */
const SPEED = 1;

/** Cadence du retour arrière : une lettre par mot à chaque battement (secondes) */
const ERASE_TICK = 0.06;

/** Retour arrière : réduit le texte d'un élément lettre par lettre depuis la fin
 *  (TextPlugin, lui, retire les lettres depuis le début) */
function erase(el: HTMLElement, from: string, to: string, duration: number, suffix = '') {
  const state = { n: from.length };
  return gsap.to(state, {
    n: to.length,
    duration,
    ease: 'none',
    onUpdate: () => {
      el.textContent = from.slice(0, Math.round(state.n)) + suffix;
    },
  });
}

export function runLoader(): Promise<void> {
  const loader = document.querySelector<HTMLElement>('[data-loader]');
  const visible = loader && getComputedStyle(loader).display !== 'none';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const logo = loader?.querySelector<HTMLElement>('[data-loader-logo]');
  const dots = loader?.querySelector<HTMLElement>('[data-loader-dots]');
  const words = [...(loader?.querySelectorAll<HTMLElement>('[data-loader-word]') ?? [])];

  const markupOk = logo && dots && words.length === WORDS.length;

  const siteLogo = document.querySelector<HTMLElement>('[data-site-logo]');
  const siteBraces = [...document.querySelectorAll<HTMLElement>('[data-site-logo-brace]')];
  /** Affiche le logo du header ; avec fadeBraces, les accolades arrivent ensuite en fondu */
  const showSiteLogo = (fadeBraces = false) => {
    if (siteLogo) siteLogo.style.opacity = '1';
    if (fadeBraces) {
      gsap.to(siteBraces, { opacity: 1, duration: 0.6, ease: 'power2.out', delay: 0.15 });
    } else {
      siteBraces.forEach((b) => (b.style.opacity = '1'));
    }
  };

  if (!loader || !visible || reducedMotion || !markupOk) {
    if (loader && visible && !markupOk) {
      console.warn('[loader] balisage inattendu : vérifie que Loader.astro est à jour');
    }
    loader?.remove();
    showSiteLogo();
    return Promise.resolve();
  }

  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* navigation privée stricte : sans conséquence */
  }

  // Pas de scroll de la page cachée derrière le loader
  const root = document.documentElement;
  root.style.overflow = 'hidden';

  // Si le navigateur se fige un instant (premier chargement, dev, enregistrement d'écran),
  // GSAP rattrape le temps perdu d'un coup : des lettres sautent. Pendant le loader,
  // un gel de plus de 100 ms compte pour une seule image : l'animation marque une pause
  // au lieu de sauter des étapes. (app.ts désactive ce lissage pour Lenis : rétabli à la fin.)
  gsap.ticker.lagSmoothing(100, 16);

  return new Promise((resolve) => {
    document.fonts.ready.then(() => {
      const tl = gsap.timeline({ defaults: { ease: 'none' } });
      tl.timeScale(SPEED);

      // 1. Trois points : bim, bim, bim (steps = apparition franche, point par point)
      tl.to(dots, { text: '...', duration: 0.84, ease: 'steps(3)' }, '+=0.35')

        // 2. Effacés
        .add(erase(dots, '...', '', 0.18), '+=0.35');

      // 3. Frappe des trois mots
      WORDS.forEach((word, i) => {
        tl.to(words[i], { text: word, duration: word.length * 0.055 }, i === 0 ? '+=0.3' : undefined);
      });

      // 4. Retour arrière, inverse de la frappe, sur un battement régulier :
      //    à chaque battement, chaque mot perd sa dernière lettre (en gardant
      //    son initiale). Les mots courts atteignent leur initiale plus tôt et
      //    attendent ; les espaces partent tous ensemble au tout dernier battement.
      const bases = WORDS.map((w) => w.trimEnd());
      const spaces = WORDS.map((w, i) => w.slice(bases[i].length));
      const beats = Math.max(...bases.map((b) => b.length - 1));
      for (let k = 1; k <= beats; k++) {
        tl.call(() => {
          words.forEach((el, i) => {
            const len = Math.max(1, bases[i].length - k);
            el.textContent = bases[i].slice(0, len) + spaces[i];
          });
        }, [], k === 1 ? '+=0.6' : `+=${ERASE_TICK}`);
      }
      tl.call(() => words.forEach((el, i) => (el.textContent = bases[i][0])), [], `+=${ERASE_TICK}`);

      // 5. Sortie : CSS glisse et rétrécit jusqu'à la place exacte du logo du header,
      //    pendant que le fond du loader s'efface et que la page apparaît.
      //    Les positions sont mesurées au dernier moment (taille de fenêtre à jour).
      const MOVE_DURATION = 1.1;
      tl.call(() => {
        root.style.overflow = '';
        loader.style.pointerEvents = 'none';
        resolve();

        const bg = getComputedStyle(loader).backgroundColor.replace(/^rgb\((.+)\)$/, 'rgba($1, 0)');
        gsap.to(loader, { backgroundColor: bg, duration: (MOVE_DURATION * 0.7) / SPEED, ease: 'power2.inOut' });

        if (!siteLogo) {
          gsap.to(logo, { opacity: 0, duration: 0.5 / SPEED });
          return;
        }
        const from = logo!.getBoundingClientRect();
        const to = siteLogo.getBoundingClientRect();
        gsap.to(logo, {
          x: to.left - from.left,
          y: to.top - from.top,
          scale: to.height / from.height,
          transformOrigin: '0 0',
          duration: MOVE_DURATION / SPEED,
          ease: 'expo.inOut',
        });
      }, [], '+=0.5')
        .to({}, { duration: MOVE_DURATION })
        // Relais : le logo du header prend la place du CSS du loader
        .call(() => {
          showSiteLogo(true);
          loader.remove();
          gsap.ticker.lagSmoothing(0);
        });
    });
  });
}