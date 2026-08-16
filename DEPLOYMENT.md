# Deploying Lifestyle Hikers Studio (for your team)

This guide walks you through deploying the app so your other Lifestyle Hikers member
can log in from their own computer/phone — no access to your machine needed.

You'll use **two free services**:

1. **Supabase** — cloud database + file storage (so everyone shares the same data).
2. **Vercel** — hosts the app and gives you a public URL.

Both have free tiers that are plenty for a small team.

---

## 0. Prerequisite: a Git repo

Vercel deploys from a Git repository. If this project isn't in Git yet:

```bash
cd "/Users/itsupport/Documents/Lifestyle carousel"
git init
git add .
git commit -m "Initial commit"
```

Then push it to GitHub/GitLab (a free private repo is fine).

---

## 1. Create a Supabase project (free)

1. Go to https://supabase.com and sign up.
2. Click **New project**, give it a name (e.g. `lifestyle-hikers`), set a database password, and pick a region close to you.
3. Wait for it to provision (a minute or two).

### Set up the database

1. In the Supabase dashboard, open the **SQL Editor**.
2. Paste the entire contents of `supabase-schema.sql` (in this project's root) and click **Run**.
   - This creates all tables AND the private `lifestyle-hikers-media` storage bucket.

### Get your keys

1. In Supabase, go to **Project Settings → API**.
2. Copy these two values:
   - `Project URL` (looks like `https://xxxx.supabase.co`)
   - `service_role` key (the long one — **keep it secret**)

---

## 2. Deploy on Vercel (free)

1. Go to https://vercel.com and sign up (you can use your GitHub account).
2. Click **Add New → Project**.
3. Import the repo you pushed in step 0.
4. Vercel auto-detects Next.js — leave the defaults.
5. Before deploying, add these **Environment Variables** (Production):

| Name | Value |
|---|---|
| `SESSION_SECRET` | a long random string — generate with `openssl rand -base64 32` |
| `APP_URL` | `https://YOUR-PROJECT.vercel.app` (your final Vercel URL) |
| `SUPABASE_URL` | your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase `service_role` key |
| `SUPABASE_STORAGE_BUCKET` | `lifestyle-hikers-media` |

6. Click **Deploy**.

---

## 3. (Optional) Google Drive import

If you want members to pull photos from a shared Google Drive:

1. Create a Google Cloud OAuth 2.0 **Web application** credential.
2. Add the callback URL: `https://YOUR-PROJECT.vercel.app/api/integrations/google/callback`.
3. Add these env vars on Vercel:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI=https://YOUR-PROJECT.vercel.app/api/integrations/google/callback`

Skip this if members will just drag-and-drop photos from their phones/computers.

---

## 4. (Optional) Direct Instagram publishing

Only if you want the app to publish to Instagram automatically. You'll need a Meta
Developer app with Instagram Login + content-publish permission. See `INSTAGRAM-PUBLISHING.md`.

If you skip this, members just **download the ZIP and post manually** — which works
with no extra setup.

---

## 5. Share access with your team member

Once deployed, you have a public URL like `https://your-project.vercel.app`.

Share **one shared login** (register a single account, or you create it and share the
credentials with your team member). Everyone who logs into that account sees the same
projects, library, and campaigns.

> **Important:** The current app is single-account-oriented. A shared login means you
> both use the same account. If you later want separate logins with roles (e.g. "uploader"
> vs "editor") under one team workspace, that requires a small feature addition.

---

## 6. Verify it works

1. Open your Vercel URL on your phone.
2. Log in with the shared account.
3. Create a campaign, upload a few photos.
4. Have your team member log in from their phone — they should see the same project.
5. Download the ZIP and post it.

---

## Local development (no deployment)

If you only ever run it on your own machine, you don't need Supabase or Vercel:

```bash
npm install
cp .env.example .env   # set SESSION_SECRET
npm run db:migrate
npm run dev
```

The app falls back to local SQLite + files. But this only works on **your** computer —
your team member can't reach it remotely.
