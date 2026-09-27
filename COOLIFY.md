# Deploy ProjectHub with Coolify

Coolify builds the app from a GitHub repository using `docker-compose.coolify.yml`.
It creates the database password, session secret and admin password for you, and serves the app over HTTPS.

## 1. Put the code on GitHub (once)

1. On github.com click **New repository** → name it `projecthub` → **Private** → **Create repository**.
2. On the empty repository page, click **uploading an existing file**.
3. Open the **ProjectHub-GitHub** folder on your Desktop, press **⌘A** to select everything, and drag it onto the GitHub page.
4. Wait until all files are listed, then click **Commit changes**.

## 2. Create the app in Coolify

1. In Coolify open your project → **+ New** → **Private Repository (with GitHub App)**.
   Pick the same GitHub App you used for your other project.
   If `projecthub` isn't in the list: on GitHub go to **Settings → Applications → (your Coolify app) → Configure**,
   add `projecthub` under **Repository access**, then refresh Coolify.
2. Select the `projecthub` repository and branch `main`.
3. Set **Build Pack** to **Docker Compose**, **Base Directory** to `/`,
   **Docker Compose Location** to `/docker-compose.coolify.yml` → **Continue**.
4. In the app's configuration, under the **app** service, check the **Domains** field:
   keep the generated address, or enter your own, e.g. `https://projects.yourcompany.com`
   (point that domain's DNS A record to the server first).
5. Click **Deploy**. The first build takes about 5–10 minutes.

## 3. Sign in

- Email: the `ADMIN_EMAIL` value (defaults to mustafa.salama97@hotmail.com — change it under
  **Environment Variables** *before* the first deploy if you want another).
- Password: in Coolify → **Environment Variables** → copy the value of **SERVICE_PASSWORD_ADMIN**.

Change the password in ProjectHub → **Settings** after signing in, then add your teammates under **Settings → Users**.

## Updates

Upload the changed files to the GitHub repository (or push with git), then click **Redeploy** in Coolify
(or turn on automatic deployments). The database and uploaded documents are kept in Docker volumes across deploys.

## Backups

The database runs in the `db` service. Use Coolify's backup settings for it if available in your version,
or open a terminal for the `db` container in Coolify and run:
`pg_dump -U "$POSTGRES_USER" -d projecthub -Fc -f /tmp/backup.dump`
