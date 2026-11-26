// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://web.cedricstoecklin.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    // /projets/demo/index.html → URL propre /projets/demo/ servie par Apache sans réécriture
    format: 'directory',
  },
  // Précharge les pages au survol des liens : la page suivante est souvent
  // déjà en cache quand l'animation de sortie se termine.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
