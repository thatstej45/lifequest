# LifeQuest Web Push worker

This Cloudflare Worker stores PWA push subscriptions in D1 and checks quest
reminders once per minute. Cloudflare Workers, Cron Triggers, and D1 all have
free tiers suitable for a personal LifeQuest installation.

## One-time deployment

1. Create a free Cloudflare account.
2. Install dependencies and authenticate:

   ```bash
   cd push-worker
   npm install
   npx wrangler login
   ```

3. Generate VAPID keys:

   ```bash
   npm run keys:generate
   ```

   Keep the private key private. Put the generated public key into
   `VAPID_PUBLIC_KEY` in `wrangler.jsonc`.

4. Create the D1 database:

   ```bash
   npm run db:create
   ```

   Copy the returned database ID into `database_id` in `wrangler.jsonc`.

5. Store the private key as a Worker secret:

   ```bash
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```

6. Create the database table and deploy:

   ```bash
   npm run db:migrate:remote
   npm run deploy
   ```

7. Copy the deployed `https://…workers.dev` URL into the GitHub repository
   variable `VITE_PUSH_API_URL` under **Settings → Secrets and variables →
   Actions → Variables**. Re-run the release workflow or push a commit so the
   web app is built with that URL.

Do not change VAPID keys after users subscribe. A key change requires every
device to enable notifications again.
