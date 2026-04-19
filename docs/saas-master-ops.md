# HaniLink SaaS Master Ops

Ce document couvre la base centrale SaaS qui gere les clients, pendant que chaque client garde sa propre base Supabase.

## Separation recommandee

- base master SaaS:
  - clients
  - domaines
  - abonnements
  - suivi de provisioning
  - configuration client
- base client:
  - utilisateurs du client
  - produits
  - ventes
  - depenses
  - documents
  - licensing client si active

## Schema master

Applique dans la base centrale:

- [supabase/templates/master-saas-schema.sql](/C:/Users/grous%20info/.codex/worktrees/b969/hanilink-saas/supabase/templates/master-saas-schema.sql)

Tables principales:

- `saas_tenants`
- `saas_tenant_domains`
- `saas_tenant_admins`
- `saas_subscriptions`
- `saas_provisioning_runs`

## Provisionner un nouveau client

Commande:

```bash
npm run tenant:provision -- --slug=client-a --name="Client A" --owner-email=owner@client-a.com --domain=client-a.hanilink.app --supabase-url=https://client-a.supabase.co --publishable-key=sb_publishable_xxx --project-ref=abc123
```

La commande genere:

- le bloc JSON a injecter dans `VITE_TENANT_CONFIGS`
- le SQL pour enregistrer le client dans la base master
- une checklist de provisioning
- un fichier dans `dist/tenant-provisioning/<slug>.json`

## Cycle d'ouverture d'un client

1. creer le projet Supabase client
2. appliquer le schema client
3. provisionner le tenant avec `npm run tenant:provision`
4. enregistrer le tenant dans la base master avec le SQL genere
5. injecter le bloc client dans `VITE_TENANT_CONFIGS`
6. deployer le frontend
7. tester via `?tenant=<slug>` ou le domaine dedie

## Vision suivante

Le prochain cran naturel est un petit backoffice admin qui:

- liste `saas_tenants`
- cree un payload de provisioning
- suit l'etat d'ouverture
- centralise les plans et abonnements
