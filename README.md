# ১ দিনের সস্তায় ট্যুর — Setup, Security & Deployment Guide

> **Tagline:** প্ল্যান ক্যানসেল না হইলেই হয়।  
> **Tour Date:** 28 November 2026 (Saturday) • C&B, Savar → Panam Nagar, Sonargaon → Puran Dhaka  
> **Treasurer/Admin:** Shahriar

---

## 1. Architecture & Free-Tier Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS v4
- **Charts:** Recharts
- **Maps:** Leaflet + OpenStreetMap (free, no API key required)
- **PWA & Offline:** `vite-plugin-pwa` Service Worker + `localStorage` offline cache for itinerary & checklist (financial writes require an online connection)
- **Database, Auth/Sessions, Realtime & Storage:** Supabase Free (PostgreSQL + Row Level Security + `SECURITY DEFINER` RPCs + Storage)
- **Hosting:** Vercel Free

---

## 2. Access & Security Model (How Private Group Auth Works)

1. **Zero Student IDs in Frontend:** DIU Student IDs are **never** stored or rendered in client-side code or returned in `members` queries. They live hashed (`SHA-256`) inside `public.member_credentials`, which has `REVOKE ALL` from `anon` and `authenticated`.
2. **Member Gate:** Visitors enter their DIU Student ID (and optional shared group passcode if enabled by Shahriar). `verify_member_access` RPC checks rate limits (`auth_rate_limits`), matches the SHA-256 hash, creates a 14-day session token (`auth_sessions`), and returns the token.
3. **Database-Enforced RLS:** Every Supabase request sends the session token via `x-tour-session`. PostgreSQL RLS policies call `is_tour_member()` and `is_tour_admin()`. Unauthorized requests receive zero rows.
4. **Admin Elevation (Shahriar Only):** Shahriar enters his Admin Password, verified by `elevate_admin_session` against a bcrypt hash (`pgcrypto`) in `admin_credentials`.
5. **Financial Integrity:** Members have strictly **read-only** access to financial tables. Only Shahriar's elevated admin session can invoke `record_contribution`, `create_expense_with_allocations`, and `update_expense_with_audit`, which enforce `SUM(allocations) == total_amount` inside a database transaction and write immutable audit entries.

---

## 3. Supabase Free Setup Instructions

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in Supabase and run these files in order:
   1. `supabase/migrations/001_schema.sql`
   2. `supabase/migrations/002_rls_and_rpcs.sql`
   3. `supabase/migrations/003_storage.sql`
3. Before running `supabase/seed.sql`:
   - Replace `REPLACE_DIU_ID_1_MAHADI` through `REPLACE_DIU_ID_6_SHOAIB` with the **six actual DIU Student IDs** in order (Mahadi, Shahriar, Seam, Ashik, Safin, Shoaib).
   - Replace `CHANGE_THIS_SHAHRIAR_ADMIN_PASSWORD` with Shahriar's chosen strong Admin Password.
   - Run `supabase/seed.sql`.
4. Enable **Realtime** in Supabase Dashboard → Database → Replication for: `contributions`, `expenses`, `tour_progress`, `photos`, `votes`, `shared_notes`, `checklist_items`.
5. Copy your Project URL and `anon` public key from **Project Settings → API**.

---

## 4. Local Development & Vercel Free Deployment

### Local Development
```bash
npm install
cp .env.example .env
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env
# (If omitted, the app runs in clearly labeled Local Development Mode using DIU-101..DIU-106)
npm run dev
```

### Vercel Deployment
1. Push this repository to GitHub/GitLab/Bitbucket.
2. Import the project in [vercel.com](https://vercel.com) (Framework Preset: **Vite**).
3. Add Environment Variables in Vercel Project Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy! `vercel.json` handles SPA routing and security headers automatically.
