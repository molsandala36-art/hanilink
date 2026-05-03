# GitHub Release automation

This repository can publish a GitHub Release automatically whenever you push a tag like `v1.0.12`.

Workflow file:

- `.github/workflows/publish-release.yml`

## What the workflow does

On every tag `v*`, GitHub Actions will:

1. install dependencies
2. build the web app
3. build the Windows desktop installer
4. sync and build the Android release APK
5. sign the Android APK if signing secrets are configured
6. publish or update the GitHub Release and attach the artifacts

## Required repository variables or secrets

Configure these in GitHub repository `Settings` -> `Secrets and variables` -> `Actions`.

Frontend runtime values:

- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- optional: `VITE_ENABLE_LICENSE_ENFORCEMENT`

Android signing values for a signed release APK:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

If the Android signing secrets are missing, the workflow will still upload the unsigned APK.

## How to publish a release

1. update your code
2. create or move the version tag
3. push the tag

Example:

```powershell
git tag v1.0.12
git push origin v1.0.12
```

GitHub Actions will then create the Release automatically.

## Published files

- `release/HaniLink Setup 0.0.0.exe`
- `android/app/build/outputs/apk/release/app-release-signed.apk` when signing is configured
- `android/app/build/outputs/apk/release/app-release-unsigned.apk`
