# HaniLink

Application de gestion connectee a Supabase, partageant le meme frontend React pour le web, le desktop et le mobile.

## Plateformes

- Web avec Vite + Express
- Desktop avec Electron
- Mobile Android avec Capacitor
- iPhone et iPad avec Capacitor + Xcode

## Prerequis

- Node.js 20+
- Un projet Supabase configure
- Android Studio pour lancer ou builder Android
- Un Mac avec Xcode pour builder iPhone/iPad

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

## iPhone et iPad

Le projet iOS est deja genere dans `ios/`, mais la compilation doit se faire sur Mac.

Depuis un Mac:

```bash
npm install
npm run mobile:sync:ios
npm run mobile:open:ios
```

Ensuite dans Xcode:

- ouvre `ios/App/App.xcworkspace`
- choisis un simulateur iPhone ou iPad
- ou configure ton compte Apple Developer pour installer sur appareil reel
- pour distribution, archive l'app puis exporte vers TestFlight ou App Store Connect

## Structure utile

- `src/`: interface commune web/mobile/desktop
- `src/services/supabase.ts`: authentification et profil Supabase
- `src/services/directApi.ts`: acces direct aux tables Supabase
- `server.ts`: serveur local web et desktop
- `electron/main.cjs`: shell desktop
- `capacitor.config.ts`: shell mobile
- `android/`: projet Android natif
- `ios/`: projet iPhone/iPad natif

## Notes

- Si Supabase est configure, l'app privilegie cette integration sur les anciens endpoints backend
- Le mobile et le web partagent exactement le meme code React
- Le desktop garde le shell Electron existant avec le serveur embarque pour le build final

## Licensing Supabase

Le repo contient maintenant une base de licensing multi-plateforme:

- migration SQL: `supabase/migrations/20260419_multiplatform_licensing.sql`
- fonctions Edge: `supabase/functions/activate-license`, `verify-license`, `heartbeat-license`, `admin-licenses`

Pour activer la verification de licence dans l'app:

1. applique la migration dans Supabase
2. deploie les fonctions Edge
3. mets `VITE_ENABLE_LICENSE_ENFORCEMENT=true`

Le meme systeme couvre web, desktop, Android, iPhone et iPad via `device_id` + `platform`.
