# Lifestyle Hikers Studio

A cloud-ready content studio for **Lifestyle Hikers Jamaica**. It turns real hike media into professionally enhanced, brand-aligned Instagram carousel campaigns.

## Content flow

```text
Phone / Camera / Lifestyle Hikers Google Drive
                    ↓
             Lifestyle Hikers Studio
                    ↓
          Preserve original source
                    ↓
        Professional photo enhancement
                    ↓
       Content intelligence + scoring
                    ↓
          Lifestyle Hikers carousel
                    ↓
             Human review
                    ↓
              ZIP / Publish
```

## Production stack

- **Vercel** — Next.js application
- **Supabase Postgres** — users, projects, media metadata, concepts and carousels
- **Supabase Storage** — original, enhanced, derivative and export files
- **Google Drive** — optional read-only source library for Lifestyle Hikers hike media
- **OpenAI-compatible AI** — optional richer analysis/copy; deterministic fallback remains available
- **Meta API** — reserved for Instagram publishing integration

The app automatically uses Supabase when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured. Without them it retains SQLite + local-media fallback for local development.

## Features

1. Upload JPG, JPEG, PNG, WebP, HEIC, MP4 and MOV directly.
2. Connect **Lifestyle Hikers Google Drive** with read-only OAuth access.
3. Browse Drive folders and select hike photos/videos directly from the campaign screen.
4. Preserve originals immutably.
5. Create an Enhanced Master without changing people, geography, weather, objects or the real scene.
6. Analyze scene, lighting, terrain and photographic quality.
7. Generate and score multiple content concepts.
8. Create editorial Lifestyle Hikers carousel slides at 1080×1350.
9. Generate captions, hashtags, SEO terms and alt text.
10. Review, edit, switch concepts and export.

## Local setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

Set `SESSION_SECRET` to a strong random secret.

## Supabase production setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `supabase-schema.sql`.
4. Add these server-side environment variables:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=lifestyle-hikers-media
```

The service-role key must remain server-side. Never expose it with a `NEXT_PUBLIC_` prefix.

The SQL script creates a private `lifestyle-hikers-media` bucket and the production tables used by the app.

## Google Drive setup

The app requests **read-only Google Drive access**. It never needs the user's Google password and does not modify or delete Drive files.

Create a Google Cloud OAuth 2.0 **Web application** credential and add:

Local callback:

```text
http://localhost:3000/api/integrations/google/callback
```

Production callback example:

```text
https://YOUR_DOMAIN/api/integrations/google/callback
```

Then set:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/api/integrations/google/callback
```

Inside **Create a campaign**, the user can then select:

- direct device uploads
- Google Drive media
- or both in the same campaign

Selected Drive files are downloaded server-side, copied into the app's immutable Original storage, enhanced, analyzed and processed through the same carousel pipeline as direct uploads.

## Vercel deployment

Connect the repository to Vercel and add the same environment variables under the Production environment.

Required for cloud production:

```text
SESSION_SECRET
APP_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
```

Required for Drive import:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

`APP_URL` and `GOOGLE_REDIRECT_URI` must use the final Vercel/custom domain in production.

## Storage model

```text
lifestyle-hikers-media/
  original/
  enhanced/
  derivative/
  export/
```

- `original/` is never overwritten by enhancement.
- `enhanced/` contains technically improved masters.
- `derivative/` is reserved for carousel-specific crops/renders.
- `export/` stores generated campaign packages.

## Brand system

- Handle: **@LifestyleHikers**
- Philosophy: **One foot in front the other.**
- Editorial image-first carousel design
- Tracked `LIFESTYLE HIKERS` label
- Strong uppercase headline hierarchy
- Restrained warm-gold accent
- Bottom-left faded pagination
- Localized text scrims instead of full-frame dark overlays

## Validation

```bash
npx tsc --noEmit
npm test
```

The uploaded project originally contained macOS-native dependency binaries. In a clean Linux/Vercel environment, install dependencies fresh with `npm ci` before running tests/builds.

## Direct Instagram publishing

Lifestyle Hikers Studio can connect an Instagram **Professional account** (Business or Creator) using Meta's Instagram Login OAuth flow. The app never asks for or stores the Instagram password.

### User flow

```text
Settings → Connect Instagram
       ↓
Instagram / Meta authorization
       ↓
@LifestyleHikers connected
       ↓
Create carousel → Review → Approve
       ↓
Publish to @LifestyleHikers
       ↓
Meta API creates containers + publishes
       ↓
Published media ID + publish job stored
```

### Meta app setup

Create/configure a Meta developer app with the Instagram API and **Instagram Login**. Configure the production callback URL exactly as:

```text
https://YOUR_DOMAIN/api/integrations/instagram/callback
```

Local callback:

```text
http://localhost:3000/api/integrations/instagram/callback
```

Set these server-side environment variables:

```text
META_APP_ID=YOUR_META_APP_ID
META_APP_SECRET=YOUR_META_APP_SECRET
META_REDIRECT_URI=https://YOUR_DOMAIN/api/integrations/instagram/callback
META_GRAPH_VERSION=v26.0
```

The app requests only the publishing-related scopes it needs:

```text
instagram_business_basic
instagram_business_content_publish
```

Tokens are encrypted at rest using the application's `SESSION_SECRET`-derived encryption key.

### Publishing architecture

The generated carousel slides are rendered to JPEG and stored in the private Supabase bucket. The app creates short-lived signed URLs so Meta can fetch each rendered image during media-container creation. The bucket itself remains private.

Current direct publisher supports:

- single generated image posts
- generated image carousels
- caption + hashtags from the approved campaign
- explicit approval gating
- publish-job logging
- Meta media/container IDs
- readable failure messages and retry-safe project preservation

Reels and Stories can use the same connection in a later media-publishing module; this build's generated output is currently carousel/image focused.

### App review / live use

In Meta development mode, only accounts permitted for the app can authorize it. For use by outside client accounts, configure the required Meta app-review/live-mode permissions before offering the connection publicly.

### Security rules

- Never collect Instagram passwords.
- Never expose access tokens in client-side JavaScript.
- Keep `META_APP_SECRET`, Supabase service-role key and `SESSION_SECRET` server-side.
- Require explicit carousel approval before every direct publish.
- Disconnect removes the stored Instagram authorization from Lifestyle Hikers Studio.
