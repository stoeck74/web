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
    server: {
      watch: {
        // Windows : les notifications de fichiers ratent parfois un fichier
        // remplacé par copie. Le polling vérifie les fichiers à intervalle régulier,
        // plus besoin de relancer le serveur après chaque mise à jour.
        usePolling: true,
        interval: 300,
      },
    },
  },
});