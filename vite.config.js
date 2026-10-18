// Configuration de Vite (serveur de dev + construction de l'appli)
// et du plugin PWA (installation sur téléphone + fonctionnement hors ligne).
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Chemins relatifs : l'appli fonctionne quelle que soit l'adresse
  // (ex. https://moncompte.github.io/revisions/).
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate', // met à jour l'appli toute seule
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Révisions',
        short_name: 'Révisions',
        description: 'Planifie tes révisions selon la courbe de l\'oubli',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#12151c',
        theme_color: '#12151c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tous les fichiers de l'appli sont mis en cache pour le hors ligne.
        // Le moteur PDF (pdf.js) est gros : on autorise jusqu'à 5 Mo par fichier.
        globPatterns: ['**/*.{js,mjs,css,html,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    // Dans les tests, on utilise la version "navigateur" de mammoth (lecture Word),
    // la même que dans l'appli.
    alias: { mammoth: 'mammoth/mammoth.browser.js' },
  },
});
