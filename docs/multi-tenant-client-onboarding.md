# HaniLink Multi-Tenant Onboarding

Ce guide sert a creer un nouveau client avec sa base Supabase separee.

## Principe

- 1 client = 1 projet Supabase
- 1 projet Supabase client = ses users, ses donnees, ses policies, sa config
- le frontend HaniLink choisit le bon client via:
  - `?tenant=<slug>`
  - le slug memorise dans le navigateur
  - le domaine
  - `VITE_DEFAULT_TENANT`

## 1. Creer le projet Supabase du client

Dans Supabase:

1. cree un nouveau projet
2. copie:
   - Project URL
   - Publishable key
3. active Email/Password dans Auth si necessaire

## 2. Appliquer le schema applicatif du client

Dans le SQL Editor du projet client, execute:

- [supabase/templates/client-app-schema.sql](/C:/Users/grous%20info/.codex/worktrees/b969/hanilink-saas/supabase/templates/client-app-schema.sql)

Si tu veux aussi le licensing dans cette base client, applique ensuite:

- [supabase/migrations/20260419_multiplatform_licensing.sql](/C:/Users/grous%20info/.codex/worktrees/b969/hanilink-saas/supabase/migrations/20260419_multiplatform_licensing.sql)

## 3. Generer l'entree tenant

Commande:

```bash
node scripts/generate-tenant-config.mjs --slug=client-a --name="Client A" --domain=client-a.hanilink.app --supabase-url=https://client-a.supabase.co --publishable-key=sb_publishable_xxx
```

Exemple de sortie:

```json
{
  "client-a": {
    "name": "Client A",
    "domains": [
      "client-a.hanilink.app"
    ],
    "supabaseUrl": "https://client-a.supabase.co",
    "supabasePublishableKey": "sb_publishable_xxx",
    "apiBaseUrl": "https://client-a.supabase.co/functions/v1"
  }
}
```

## 4. Declarer le client dans l'app

Dans Vercel ou `.env.local`, remplis:

```env
VITE_TENANT_CONFIGS={
  "client-a": {
    "name": "Client A",
    "domains": ["client-a.hanilink.app"],
    "supabaseUrl": "https://client-a.supabase.co",
    "supabasePublishableKey": "sb_publishable_xxx",
    "apiBaseUrl": "https://client-a.supabase.co/functions/v1"
  }
}
VITE_DEFAULT_TENANT=client-a
```

Si tu geres plusieurs clients, regroupe-les dans le meme JSON.

## 5. Tester le client

Tu peux tester de 3 facons:

- via domaine: `https://client-a.hanilink.app`
- via query string: `https://hanilink-saas.vercel.app/?tenant=client-a`
- via le champ `Espace client` sur login/register

## 6. Premier compte admin

Deux options:

- inscription depuis l'app
- creation directe dans Supabase Auth puis connexion

La ligne `app_users` se cree automatiquement au premier login/inscription si elle n'existe pas encore.

## 7. Si le client utilise le licensing

Dans le projet client:

1. deploie les fonctions Edge de licensing
2. applique la migration de licensing
3. cree la premiere licence via SQL ou l'admin

Guide associe:

- [docs/supabase-licensing-setup.md](/C:/Users/grous%20info/.codex/worktrees/b969/hanilink-saas/docs/supabase-licensing-setup.md)
