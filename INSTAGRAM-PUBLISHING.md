# Instagram Publishing Setup

1. Meta Developers → create/open the app used by Lifestyle Hikers Studio and keep it in **Development** mode.
2. Add **Instagram API with Instagram Login**. Add @LifestyleHikers as an Instagram tester (and accept the invitation in Instagram); app administrators may also authorize it.
3. Confirm @LifestyleHikers is a **Business or Creator** account. The Instagram Login API does not technically require a linked Facebook Page, but keep the Page link required by the Lifestyle Hikers account setup.
4. Add the exact OAuth redirect URI:
   - Local: `http://localhost:3000/api/integrations/instagram/callback`
   - Production: `https://YOUR_DOMAIN/api/integrations/instagram/callback`
5. Configure the server-only environment variables from `.env.example`. Set `META_INSTAGRAM_ACCOUNT_ID` to the numeric ID for @LifestyleHikers for the strongest single-account lock.
6. Run the updated `supabase-schema.sql` in Supabase and confirm the private `lifestyle-hikers-media` bucket exists.
7. Deploy to Vercel.
8. Open **Settings → Connect Instagram** and authorize only @LifestyleHikers.
9. Create and approve a carousel.
10. In **Review**, click **Publish to @LifestyleHikers**.

The OAuth flow uses `https://www.instagram.com/oauth/authorize` with `instagram_business_basic,instagram_business_content_publish`, exchanges the authorization code at `https://api.instagram.com/oauth/access_token`, and exchanges the result for a long-lived token at `https://graph.instagram.com/access_token`.

The publishing endpoint renders the final approved slides, uploads derivatives to private Supabase Storage, issues short-lived signed media URLs, creates Instagram media containers, creates the carousel container, publishes it, and records the returned Meta media ID.
