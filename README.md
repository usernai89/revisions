# Révisions 📚

Application de révision **hors ligne**, installable sur téléphone (PWA),
qui planifie automatiquement tes révisions selon la courbe de l'oubli.
Toutes les données restent sur ton téléphone (IndexedDB).

Cahier des charges complet : [docs/cahier-des-charges.md](docs/cahier-des-charges.md)

## État d'avancement

- [x] **MVP** : matières, import PDF / texte collé, planification J0 → J1 → J3 (→ J7, J14, J30),
      écran « Aujourd'hui », lecture guidée avec surlignage, QROC, rappel actif, mode sombre, hors ligne
- [x] Import Word (.docx) et PowerPoint (.pptx), publication sur GitHub Pages
- [x] Étapes modifiables dans les réglages (jour + méthode), J7 texte à trous, J14/J30 mélange (flashcards + trous)
- [x] Temps disponible par jour (semaine / week-end) + répartition de la charge sur les jours suivants
- [x] Textes à trous et flashcards générés automatiquement
- [x] Mes propres QCM / QROC (avec énoncé de cas clinique), QCM automatiques à partir des définitions
- [x] Nouvelle interface « réseau de transport »
- [x] Statistiques (écran Bilan) : réussite, ponctualité, retards, leçons vues, activité sur 14 jours, rapport par matière
- [x] Export / import de sauvegarde (fichier .json, rappel au bout de 14 jours)
- [x] IA facultative (désactivée par défaut) : Claude, OpenAI, Mistral ou tout service compatible OpenAI

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

## L'interface

L'appli reprend le langage visuel des transports (on révise souvent dans le métro) :
- chaque **matière** est une **ligne** de couleur, avec sa pastille ;
- chaque **leçon** suit un **trajet** J0 → J1 → J3 → J7 → J14 → J30 ;
- l'écran **Aujourd'hui** est un **tableau des départs** ; la jauge compte le temps par quart d'heure.

Polices incluses (fonctionnent hors ligne) : Nunito (titres et texte, lettres arrondies),
JetBrains Mono (horaires).

## Sauvegarder ses données

Tout est stocké sur le téléphone. **Réglages → Sauvegarde → Exporter** crée un fichier
`revisions-sauvegarde-AAAA-MM-JJ.json` : sur téléphone, le menu de partage s'ouvre
(enregistre-le dans Fichiers, Drive, ou envoie-le-toi par mail) ; sur ordinateur, il est
téléchargé. **Importer** remplace toutes les données actuelles par celles du fichier.
L'écran « Aujourd'hui » te le rappelle si ta dernière sauvegarde date de plus de 14 jours.

## IA (facultative)

Désactivée par défaut : l'appli fonctionne entièrement sans. Pour l'activer :
**Réglages → IA → Activée**, choisis le fournisseur, colle **ta** clé API, puis **Tester**.
Un bouton « Générer N questions avec l'IA » apparaît alors sur chaque leçon.

| Fournisseur | Ce qu'il faut |
|---|---|
| Claude (Anthropic) | une clé (console.anthropic.com) ; modèle par défaut `claude-opus-5-5` |
| OpenAI | une clé (platform.openai.com) + le nom du modèle |
| Mistral | une clé (console.mistral.ai) + le nom du modèle |
| Autre, compatible OpenAI | l'adresse de l'API (ex. OpenRouter, Groq, ou Ollama en local `http://localhost:11434/v1`) + le modèle |

- Le texte de la leçon est envoyé au fournisseur à chaque génération ; il la facture selon ses tarifs.
- La clé reste sur le téléphone et **n'est jamais incluse dans les sauvegardes**.
- Les questions de l'IA (étiquette « IA ») se modifient ou se suppriment comme les autres.
- Pour ajouter un fournisseur : un module avec une fonction `generate()` dans `src/ai/`, déclaré dans `PROVIDERS` (`src/ai/index.js`).

## Comment ça marche (en bref)

| Fichier | Rôle |
|---|---|
| `src/main.js` | Démarrage + navigation entre écrans |
| `src/db.js` | Base de données locale (matières, leçons, révisions, questions) |
| `src/settings.js` | Réglages (intervalles, méthodes, thème) |
| `src/scheduler.js` | ★ Planification : dates, priorités, report des révisions ratées |
| `src/ai/` | IA facultative : `prompt.js` (consigne + vérification), `anthropic.js` (Claude), `openaiCompatible.js` (OpenAI, Mistral…), `index.js` (choix du fournisseur) |
| `src/backup.js` | Export / import de toutes les données dans un fichier .json |
| `src/stats.js` | Calcul des statistiques (réussite, ponctualité, retards, activité) |
| `src/text.js` | Nettoyage et découpage du texte des cours |
| `src/import/` | Extraction du texte : `pdf.js`, `docx.js` (Word), `pptx.js` (PowerPoint), `index.js` choisit le bon |
| `src/generators/local.js` | Génération des questions sans IA (définitions, listes) |
| `src/generators/cloze.js` | Génération des textes à trous (choix des mots-clés) |
| `src/generators/qcm.js` | Choix QCM ou QROC, QCM automatiques, correction des QCM |
| `src/methods/` | Une méthode par fichier : lecture, QROC, rappel actif, texte à trous, flashcards, mélange |
| `src/screens/` | Un écran par fichier |
| `tests/` | Tests automatiques |

**Règle de planification** : chaque leçon n'a qu'une révision « à faire » à la fois.
Quand tu la termines, la suivante est calculée **à partir du jour où tu as vraiment révisé**.
Une révision ratée reste donc en tête de liste (« en retard ») sans décaler tout le reste.

**Temps par jour** : chaque révision a une durée estimée. L'écran « Aujourd'hui » prend les
révisions par ordre de priorité tant qu'elles rentrent dans ton temps du jour ; le reste est
reporté au lendemain (en tête de liste). La section « Prochains jours » montre la charge prévue.
