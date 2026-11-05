# CABSSA Clubdesk — Supabase Production Setup Guide

This guide walks through configuring Supabase as the production database and backend for CABSSA Clubdesk.

---

## 1. Quick Setup in Supabase Dashboard

1. Create a project on [database.new](https://database.new) or your self-hosted Supabase instance.
2. Open the **SQL Editor** in the Supabase Dashboard.
3. Run the migration scripts in sequential order:
   - `supabase/migrations/01_schema.sql` (Tables, Foreign Keys, Indexes, Triggers)
   - `supabase/migrations/02_rls.sql` (Row Level Security & Role Helper Functions)
   - `supabase/migrations/03_storage.sql` (Storage Buckets & Permissions)
   - `supabase/migrations/04_seed.sql` (Domains, Initial Admin & Core Records)

---

## 2. Authentication Configuration

1. In Supabase Dashboard, go to **Authentication** > **Providers** > **Email**.
2. **Enable Email provider**.
3. (Recommended for closed clubs): In **Authentication** > **Settings**:
   - Turn **OFF** "Allow new users to sign up" (ensures only Admin-provisioned members can log in).
   - Turn **OFF** "Confirm email" if you want members to immediately log in with their college credentials.

---

## 3. Storage Setup

The migration `03_storage.sql` automatically registers the `member-photos` and `club-documents` buckets.
Verify in **Storage** that `member-photos` is public and allows image uploads.

---

## 4. Deploying Edge Function

To deploy the privileged admin provisioning Edge Function:

```bash
# Login to Supabase CLI
npx supabase login

# Link your remote project
npx supabase link --project-ref <your-project-ref>

# Deploy the function
npx supabase functions deploy admin-provision-member
```

---

## 5. Connecting Frontend to Supabase

In the CABSSA Clubdesk UI, click **Settings / Database Connection** in the left sidebar, or edit `js/config.js`:

```javascript
window.CABSSA_CONFIG = {
  SUPABASE_URL: "https://your-project.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  EDGE_FUNCTION_URL: "https://your-project.supabase.co/functions/v1/admin-provision-member"
};
```
