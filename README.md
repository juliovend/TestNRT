# TNR Manager (Hostinger + React + PHP)

Starter complet pour une application web de gestion de tests de non-régressions (TNRs):

- **Frontend**: React + Vite + TypeScript + MUI (dans `app/`)
- **Backend API**: PHP natif + PDO (dans `public_html/api/`)
- **DB**: MySQL (`db/schema.sql` + `db/seed.sql`)
- **Auth**: email/mot de passe + Google OAuth2
- **Session**: cookie PHP HttpOnly (pas de JWT)

## 1) Structure

- `app/`: code source SPA React
- `public_html/`: dossier déployé sur Hostinger
  - `api/`: endpoints PHP
  - `.htaccess`: fallback SPA (sans réécriture de `/api`)
- `db/`: scripts SQL

## 2) Pré-requis

- Node.js 18+
- PHP 8.1+
- MySQL 8+
- Apache avec `mod_rewrite`

## 3) Setup base de données

1. Créer la base MySQL.
2. Importer:
   - `db/schema.sql`
   - `db/seed.sql` (optionnel, après avoir un user)

## 4) Config API

1. Copier `public_html/api/config.sample.php` vers `public_html/api/config.php`.
2. Renseigner:
   - credentials DB
   - `app_url`
   - Google OAuth (`client_id`, `client_secret`, `redirect_uri`)
3. `config.php` est ignoré par Git.

## 5) Développement local

### Frontend
```bash
cd app
npm install
npm run dev
```

### Backend
- Pointer Apache/Nginx vers `public_html/`.
- Vérifier que `public_html/api/index.php` répond.

## 6) Build et déploiement Hostinger

1. Builder le front:
```bash
cd app
npm install
npm run build
```

2. Copier le contenu de `app/dist/` dans `public_html/` (sans supprimer `public_html/api/` ni `.htaccess`).

3. Déployer via GitHub -> Hostinger vers `/public_html`.

4. Créer `public_html/api/config.php` sur le serveur avec les secrets de prod.

## 7) Endpoints principaux

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`

### Métier
- `GET/POST /api/projects`
- `GET/POST /api/releases`
- `GET/POST/PUT /api/test_cases`
- `POST /api/runs/create`
- `GET /api/runs/get?id={runId}`
- `POST /api/runs/set_result`

## 8) Notes sécurité

- `password_hash` / `password_verify` utilisés.
- Session cookie `HttpOnly`, `SameSite=Lax`, `secure=true` en prod.
- Tous les endpoints métier sont protégés par session + membership projet.
