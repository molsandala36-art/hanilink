# HaniLink

Application de gestion connectee a Supabase, partageant le meme frontend React pour le web, le desktop et le mobile.

## Plateformes

- Web avec Vite + Express
- Desktop avec Electron
- Mobile Android avec Capacitor

## Prerequis

- Node.js 20+
- Un projet Supabase configure
- Android Studio pour lancer ou builder Android

## Variables d'environnement

Cree un fichier `.env.local` avec:

```env
VITE_SUPABASE_URL=https://fsepdkctrlsrysbvnnmk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Web

```bash
npm install
npm run dev
```

L'application locale tourne sur `http://localhost:5000`.

## Desktop

En developpement, lance le web puis Electron dans un second terminal:

```bash
npm run dev
```

```bash
npm run desktop:dev
```

Pour generer l'application Windows:

```bash
npm run desktop:build
```

Le build sort dans `release/`.

## Mobile Android

Compiler le frontend puis synchroniser Capacitor:

```bash
npm run mobile:sync
```

Ouvrir ensuite le projet Android:

```bash
npm run mobile:open:android
```

## Structure utile

- `src/`: interface commune web/mobile/desktop
- `src/services/supabase.ts`: authentification et profil Supabase
- `src/services/directApi.ts`: acces direct aux tables Supabase
- `server.ts`: serveur local web et desktop
- `electron/main.cjs`: shell desktop
- `capacitor.config.ts`: shell mobile

## Notes

- Si Supabase est configure, l'app privilegie cette integration sur les anciens endpoints backend
- Le mobile et le web partagent exactement le meme code React
- Le desktop garde le shell Electron existant avec le serveur embarque pour le build final
