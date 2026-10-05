# Swap – setup and hosting

Files: `login.html` (sign in/up), `index.html` (app), `config.js` (your keys), `schema.sql` (database + privacy rules).

## 1. Create the server (Supabase, free tier)
1. Sign up at supabase.com → **New project**. Pick a region near India (e.g. Mumbai) and save the database password.
2. **SQL Editor → New query** → paste all of `schema.sql` → **Run**.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key into `config.js`.

## 2. Host the website (Netlify, free)
1. Go to app.netlify.com → **Add new site → Deploy manually** → drag the whole `swap-app` folder in.
2. Copy your site URL (e.g. `https://swap-xyz.netlify.app`). Rename it under Site settings if you like.
(Alternatives: Cloudflare Pages, Vercel, GitHub Pages work the same way – it is just static files.)

## 3. Tell Supabase your site URL
**Authentication → URL Configuration**: set *Site URL* to your site URL, and add `https://YOUR-SITE/index.html` under *Redirect URLs*.

## 4. Email sign-in
Enabled by default. Email confirmation is on, so new users must click the link in their inbox. For many users, set up a custom SMTP sender (Authentication → Emails → SMTP) because the default allows very few emails per hour.

## 5. Google sign-in
1. console.cloud.google.com → create a project → **APIs & Services → OAuth consent screen** (External) → fill basics.
2. **Credentials → Create credentials → OAuth client ID → Web application**. Under *Authorized redirect URIs* add the callback URL shown in Supabase at **Authentication → Providers → Google**.
3. Paste the Client ID and Client Secret into that Supabase page and enable it.

## 6. Apple sign-in (needs a paid Apple Developer account, about $99/year)
1. developer.apple.com → Identifiers → create an **App ID** with Sign in with Apple, then a **Services ID** (this is your client ID).
2. In the Services ID, set your site domain and the Supabase callback URL as the return URL.
3. Create a **Key** with Sign in with Apple. Supabase's Apple provider page (Authentication → Providers → Apple) explains how to generate the client secret from it.
If you skip Apple, remove the Apple button from `login.html`.

## 7. Make yourself the admin (ID reviewer)
Sign up in the app once, then run this in the SQL Editor with your email:
```sql
update profiles set is_admin = true where id = (select id from auth.users where email = 'you@example.com');
```
Reload the app. A **Review IDs** tab appears. Open each pending ID, then Approve or Reject. Approved members get posting and messaging.

## How privacy works
- ID photos live in a private storage bucket. Only the owner and admins can read them (via short-lived links).
- Chats are protected by database rules: only the two people in a thread can read or write its messages.
- Only admins can mark someone verified. Users cannot edit their own verified flag.

## Before going live
- ID verification is manual review. For scale or legal compliance, use a KYC provider. In India, Aadhaar collection by private parties is restricted; consider a government-backed or authorised verification route and add a privacy policy.
- Keep the *service_role* key out of the website. Only the anon key goes in `config.js`.
