# Révisions 📚

Application de révision **hors ligne**, installable sur téléphone (PWA),
qui planifie automatiquement tes révisions selon la courbe de l'oubli.
Toutes les données restent sur ton téléphone (IndexedDB).

Cahier des charges complet : [docs/cahier-des-charges.md](docs/cahier-des-charges.md)

## État d'avancement

- [x] **MVP** : matières, import PDF / texte collé, planification J0 → J1 → J3 (→ J7, J14, J30),
      écran « Aujourd'hui », lecture guidée avec surlignage, QROC, rappel actif, mode sombre, hors ligne
- [x] Import Word (.docx) et PowerPoint (.pptx), publication sur GitHub Pages
- [ ] Méthode par étape modifiable dans les réglages
- [ ] Temps disponible par jour + répartition de la charge
- [ ] Textes à trous et flashcards générés automatiquement
- [ ] Mes propres QCM / QROC
- [ ] Statistiques par matière
- [ ] Export / import de sauvegarde
- [ ] Emplacement pour une IA (désactivé par défaut)

## Lancer l'appli sur ton ordinateur

Il faut [Node.js](https://nodejs.org) (version 20 ou plus).

```bash
npm install        # une seule fois : télécharge les outils
npm run dev        # lance l'appli → ouvre http://localhost:5173
npm test           # lance les tests automatiques
npm run build      # fabrique la version finale dans le dossier dist/
npm run preview    # teste la version finale (avec le mode hors ligne)
```

## Installer l'appli sur ton téléphone (GitHub Pages)

À faire **une seule fois** sur github.com :

1. **Settings → General → Danger Zone → Change visibility → Public**
   (seul le code devient visible ; tes cours restent sur ton téléphone).
2. **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.

Ensuite, chaque modification de la branche `main` publie l'appli automatiquement
(onglet **Actions** pour suivre). Elle est disponible à l'adresse :
**https://usernai89.github.io/revisions/**

Sur le téléphone :
- **Android (Chrome)** : ouvre l'adresse → menu ⋮ → **Installer l'application**.
- **iPhone (Safari)** : ouvre l'adresse → bouton Partager → **Sur l'écran d'accueil**.

L'appli fonctionne ensuite hors ligne. Elle se met à jour toute seule quand tu as du réseau.

## Comment ça marche (en bref)

| Fichier | Rôle |
|---|---|
| `src/main.js` | Démarrage + navigation entre écrans |
| `src/db.js` | Base de données locale (matières, leçons, révisions, questions) |
| `src/settings.js` | Réglages (intervalles, méthodes, thème) |
| `src/scheduler.js` | ★ Planification : dates, priorités, report des révisions ratées |
| `src/text.js` | Nettoyage et découpage du texte des cours |
| `src/import/` | Extraction du texte : `pdf.js`, `docx.js` (Word), `pptx.js` (PowerPoint), `index.js` choisit le bon |
| `src/generators/local.js` | Génération des questions sans IA (définitions, listes) |
| `src/methods/` | Une méthode de révision par fichier (lecture, QROC, rappel actif) |
| `src/screens/` | Un écran par fichier |
| `tests/` | Tests automatiques |

**Règle de planification** : chaque leçon n'a qu'une révision « à faire » à la fois.
Quand tu la termines, la suivante est calculée **à partir du jour où tu as vraiment révisé**.
Une révision ratée reste donc en tête de liste (« en retard ») sans décaler tout le reste.
