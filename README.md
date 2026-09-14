# 3seq Stremio Addon

Addon Stremio officiel pour les contenus autorisés provenant de :

👉 https://u.3seq.cam/

Cet addon expose **uniquement** les contenus et URLs vidéo directement publiques
et autorisées à la redistribution par le site. Les lecteurs tiers ou les
contenus protégés ne sont **pas** contournés.

---

## 1. Installation locale

### Prérequis

- **Node.js 20** ou supérieur
- npm fourni avec Node.js

Vérifier les versions :

```bash
node --version   # doit afficher v20.x ou plus
npm --version
```

### 2. `npm install`

Cloner le dépôt (ou le récupérer depuis GitHub), puis installer les
dépendances :

```bash
cd 3seq-stremio-addon
npm install
```

Seules deux dépendances de production sont utilisées :
- `express` — serveur HTTP
- `cheerio` — parsing HTML

### 3. `npm start`

Démarrer le serveur en local :

```bash
npm start
```

Par défaut, le serveur écoute sur le port **3000**.

Le terminal affiche un écran de démarrage résumant :
```
NODE_ENV : development
PORT     : 3000
BASE_URL : http://localhost:3000
```

### 4. Test de `/health`

Ouvrir dans un navigateur ou avec `curl` :

```bash
curl http://localhost:3000/health
```

Réponse attendue :

```json
{
  "status": "ok",
  "uptime": ...,
  "timestamp": "...",
  "version": "1.0.0"
}
```

### 5. Test de `/manifest.json`

```bash
curl http://localhost:3000/manifest.json
```

Le JSON doit contenir au minimum :
- `id: "com.3seq.stremio"`
- `types: ["series", "movie"]`
- `resources: ["catalog", "meta", "stream"]`
- `catalogs: [...]` (séries + films)
- `idPrefixes: ["3seq:"]`

---

## Endpoints publics

| Méthode | Chemin | Description |
|---|---|---|
| GET | `/` | Statut de l'addon |
| GET | `/health` | Health check (pour Render / monitor) |
| GET | `/manifest.json` | Manifest Stremio |
| GET | `/catalog/:type/:catalogId.json` | Catalogue séries / films |
| GET | `/meta/:type/:id.json` | Métadonnées (titre, affiche, description, épisodes) |
| GET | `/stream/:type/:id.json` | Sources vidéo directes |

Le paramètre `:type` accepte `series` ou `movie`.

Le paramètre `:id` est préfixé par `3seq:` (URL encodée). Exemple :

```
3seq:https%3A%2F%2Fu.3seq.cam%2Fvideo%2Fseries%2Falikara-series%2F
```

### Recherche

Stremio transmet la recherche via la query string `?search=…` :

```
/catalog/series/3seq-series.json?search=كارا
```

L'addon utilise d'abord l'endpoint public de recherche du site (`/?s=…`),
puis se rabat sur une recherche locale si aucun résultat n'est trouvé.

---

## 6. Déploiement Render

Le fichier `render.yaml` à la racine décrit le déploiement.

### Étapes

1. Pousser le projet sur GitHub.
2. Se connecter au [dashboard Render](https://dashboard.render.com/).
3. Choisir **New → Web Service**.
4. Sélectionner le dépôt `3seq-stremio-addon`.
5. Choisir un nom de service et la région souhaitée.
6. La configuration est lue automatiquement depuis `render.yaml` :
   - **Runtime** : Node.js
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Node version** : 20
7. Dans **Environment**, définir la variable `BASE_URL` avec le domaine
   public HTTPS de votre service Render (par exemple :
   `https://mon-addon.onrender.com`).
8. Lancer le déploiement.

Après déploiement, votre manifest sera accessible à :

```
https://MON-DOMAINE.onrender.com/manifest.json
```

---

## 7. Installation dans Stremio

### Bureau / mobile

1. Ouvrir Stremio.
2. Aller dans **Paramètres → Addons (ou Compléments)**.
3. Cliquer sur **Addon URL** ou **Installer depuis une URL**.
4. Coller l'URL de votre manifest :

   ```
   https://MON-DOMAINE/manifest.json
   ```

5. Cliquer sur **Installer**.

Une fois installé, vous retrouverez :
- **3seq - أحدث المسلسلات** dans les catalogues de séries
- **3seq - أحدث الأفلام** dans les catalogues de films
- La barre de recherche cherchera aussi dans vos contenus

---

## 8. Configuration des variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port d'écoute HTTP (Render force souvent `10000`) |
| `BASE_URL` | `http://localhost:${PORT}` | URL publique HTTPS complète de l'addon. **À définir obligatoirement en production.** |
| `NODE_ENV` | `development` | Passer à `production` pour activer la redirection HTTPS permanente et HSTS |
| `CACHE_ENABLED` | `true` | Passer à `false` pour désactiver globalement le cache mémoire |

### Exemple de fichier `.env` (développement local)

```env
PORT=3000
BASE_URL=http://localhost:3000
NODE_ENV=development
CACHE_ENABLED=true
```

> ⚠️ **Production** : la variable `BASE_URL` **doit** commencer par `https://`
> et correspondre exactement au domaine public où Stremio ira chercher
> le manifest.

---

## 9. Structure du projet

```
3seq-stremio-addon/
├── package.json          # Dépendances & scripts npm
├── server.js             # Serveur Express + routes principales
├── render.yaml           # Déploiement Render (Node 20)
├── README.md             # Ce fichier
├── .gitignore
│
└── src/
    ├── scraper.js        # Fetch HTML, Cheerio, cache, nettoyage texte
    ├── catalog.js        # Catalogue séries / films + recherche
    ├── meta.js           # Métadonnées (titre, affiche, description, saisons, épisodes)
    └── streams.js        # Sources vidéo directes (m3u8/mp4/webm...)
```

### Rôles

- **`server.js`** — Initialise Express, CORS, HTTPS en production, toutes
  les routes, health check, et sécurité.
- **`scraper.js`** — Opérations bas niveau réutilisables : HTTP avec
  timeout, cache mémoire, parsing HTML avec Cheerio, conversion d'URL
  relative → absolue, extraction d'images (y compris `data-img` pour
  le lazy-loading), nettoyage du texte.
- **`catalog.js`** — Construit la liste des séries depuis
  `/video/series/` et la page d'accueil, la liste des films depuis la
  page d'accueil, et la recherche. Filtrage des pages de navigation,
  doublons, tri et limitation à 100 résultats.
- **`meta.js`** — Détail d'une fiche (série ou film) : titre, affiche,
  description, année, genre, pays, langue, réalisateur, et (pour les
  séries) la liste des vidéos/épisodes avec `season` et `episode`.
- **`streams.js`** — Extrait **uniquement** les URLs de média directes
  exposées en clair dans la page (`.m3u8`, `.mp4`, `.webm`, `.mpd`,
  balises `<video>`, `<source>`, méta OpenGraph, scripts inline). Les
  iframes de lecteurs tiers ne sont **pas** suivis ni déballés. Si
  aucune URL directe n'est présente, le résultat est `{ streams: [] }`.

### Cache

Un cache mémoire simple est activé par défaut (désactivable via
`CACHE_ENABLED=false`).

| Type | Durée |
|---|---|
| Pages HTML génériques | 5 minutes |
| Catalogue | 5 minutes |
| Métadonnées | 10 minutes |
| Streams | 2 minutes |

Les TTL sont regroupés en haut de `src/scraper.js` (`CACHE_TTL`) et
peuvent être ajustés librement.

---

## 10. Dépannage

### `/health` ne répond pas

- Vérifiez que le serveur est bien démarré (`npm start`).
- Vérifiez le `PORT` utilisé (surcharge possible par `process.env.PORT`).
- Vérifiez qu'aucun pare-feu ne bloque le port.

### `/manifest.json` retourne du HTML ou une erreur

- Vérifiez que `npm install` a bien été exécuté.
- Vérifiez que `node --version` ≥ 20.
- Inspectez les logs du terminal pour toute exception.

### Le catalogue est vide (0 résultats)

- Assurez-vous que l'addon a accès à Internet et peut joindre
  `https://u.3seq.cam/` (pas de proxy sortant, pas de VPN qui casse le
  TLS).
- Activez les logs (par défaut écrits dans stderr/stdout) et cherchez
  les lignes `[catalog] … failed`.
- Si le site change de structure HTML, adaptez les sélecteurs dans
  `src/catalog.js`.

### Les métadonnées sont incomplètes (pas de description, pas d'affiche)

- Le site source n'expose pas toujours ces informations : l'addon
  renvoie uniquement ce qui est réellement présent.
- Vérifiez directement la page originale du contenu.

### Aucun stream retourné (`streams: []`)

**Comportement attendu** si le site utilise un lecteur iframe tiers ou
une protection quelconque. L'addon **ne contourne pas** :
- DRM
- Paywall / authentification
- Cloudflare / anti-bot
- Signatures d'URL
- Protections de lecteur
- Iframes tiers non autorisées

Si vous (en tant que propriétaire du site) exposez par la suite
publiquement des URLs `.m3u8` ou `.mp4` directement dans le HTML de vos
pages, celles-ci seront automatiquement récupérées.

### Stremio n'affiche pas l'addon après installation

- Vérifiez que `BASE_URL` est bien **l'URL publique HTTPS** et ne
  pointe pas vers `localhost` (sauf pour une utilisation locale
  uniquement).
- Vérifiez que `/manifest.json` est accessible **sans** authentification
  ni warning TLS.
- Sur Stremio Desktop, vous pouvez installer depuis la barre d'adresse
  en tapant : `stremio://MON-DOMAINE/manifest.json`.

### Erreur 500 au premier chargement

L'addon est conçu pour **ne jamais faire planter le serveur** :
toutes les routes sont protégées par `try/catch`, et les erreurs HTTP
du site source ainsi que les timeouts sont logguées puis absorbées.
Si vous voyez malgré tout une erreur 500, ouvrez une issue avec le
contenu des logs.

---

## Technologies utilisées

- **Node.js ≥ 20** (ES Modules, fetch natif)
- **Express** — framework HTTP
- **Cheerio** — parsing HTML côté serveur
- **Aucun TypeScript** (JS vanilla pour rester léger)
- **Aucune dépendance de build** — prêt à lancer après `npm install`

---

## Licence / Propriété

Code de l'addon : dépôt GitHub
`https://github.com/mrouss57/3seq-stremio-addon`

Contenus et site source : propriété de leurs ayants droit respectifs,
accessibles via https://u.3seq.cam/. Cet addon n'expose que ce qui est
légalement et techniquement publiquement redistribuable par le site
source.
