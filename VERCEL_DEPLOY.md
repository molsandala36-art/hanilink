# Deploiement Vercel

Ce projet peut etre deploye sur Vercel comme backend Express.

URL finale attendue:

- `https://hanilink-api.vercel.app/api`

## Etapes

1. pousser le projet sur GitHub
2. ouvrir Vercel
3. cliquer sur `Add New > Project`
4. importer le depot `hanilink-saas`
5. laisser Vercel detecter le projet Node/Express
6. verifier que le fichier [vercel.json](C:\devl\hanilink-saas\vercel.json) est bien pris en compte
7. ajouter les variables d'environnement:

```env
NODE_ENV=production
APP_URL=https://hanilink-api.vercel.app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=change-me-to-a-long-random-secret
CORS_ALLOWED_ORIGINS=https://hanilink.ma,https://app.hanilink.ma,http://localhost:5000
DESKTOP_EMBEDDED=0
SKIP_MONGO_MEMORY=1
APP_DIST_PATH=./dist
```

8. cliquer sur `Deploy`
9. ouvrir `https://hanilink-api.vercel.app/api/health`
10. verifier une reponse JSON `status: ok`
11. sur mobile, mettre `https://hanilink-api.vercel.app/api` dans `Configuration API mobile`

## Notes

- Vercel prend en charge Express dans `server.ts`
- `express.static()` n'est pas le bon mecanisme principal pour servir des assets sur Vercel
- pour le mobile, l'important est l'API `/api`, pas la racine du domaine
