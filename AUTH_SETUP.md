# Authentication Setup Guide

This guide will help you set up authentication for the Pediatric Telemedicine Platform.

## Prerequisites

- Supabase account ([sign up here](https://supabase.com))
- Node.js 18+ installed
- pnpm package manager

## Step 1: Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details:
   - Name: "Pediatric Telemedicine" (or your preferred name)
   - Database Password: Generate a strong password
   - Region: Choose closest to Dubai (e.g., Middle East or Europe)
4. Click "Create new project"
5. Wait for the project to be created

## Step 2: Configure Environment Variables

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy your project URL and anon key
3. Update `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 3: Set Up Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the contents of `database/schema.sql`
4. Paste and run the query
5. Verify tables are created in **Table Editor**

## Step 4: Configure Email Authentication

### Enable Email Verification

1. Go to **Authentication** > **Settings**
2. Under "Email Auth", ensure:
   - ✅ Enable email confirmations is **ON**
   - ✅ Secure email change is **ON**

### Configure Email Templates

1. Go to **Authentication** > **Email Templates**
2. Customize these templates:
   - **Confirm Signup**: Sent when users sign up
   - **Magic Link**: Sent for OTP login
   - **Change Email Address**: Sent when users change email
   - **Reset Password**: Sent for password reset

Example customization for "Confirm Signup":

```html
<h2>Confirm your signup</h2>
<p>Welcome to Pediatric Telemedicine Platform!</p>
<p>Follow this link to confirm your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

## Step 5: Enable OTP Authentication

1. Go to **Authentication** > **Settings**
2. Under "Auth Providers", find **Email**
3. Enable both:
   - ✅ Enable Email provider
   - ✅ Enable Email OTP

## Step 5.5: Enable Google Sign-In (OAuth)

Google Sign-In lets users authenticate with their Google account. It uses the
same PKCE callback (`/auth/callback`) as the rest of the app, so no extra app
code is required beyond enabling the provider below.

### A. Create Google OAuth credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com) and select
   (or create) a project.
2. Configure the **OAuth consent screen** (APIs & Services > OAuth consent screen):
   - User type: **External**
   - Fill in app name, support email, and developer contact
   - Add the scopes `.../auth/userinfo.email` and `.../auth/userinfo.profile`
   - While testing, add your Google account under **Test users**
3. Create credentials (APIs & Services > Credentials > **Create Credentials** >
   **OAuth client ID**):
   - Application type: **Web application**
   - **Authorized JavaScript origins:** `http://localhost:3000` and your production origin
   - **Authorized redirect URIs:** `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (find the exact value in the next step — Supabase shows it for you)
4. Copy the generated **Client ID** and **Client Secret**.

### B. Enable the Google provider in Supabase

1. In the Supabase dashboard, go to **Authentication** > **Providers** > **Google**.
2. Toggle **Enable Sign in with Google** on.
3. Paste the **Client ID** and **Client Secret** from Google Cloud.
4. Copy the **Callback URL (for OAuth)** shown here and make sure it matches the
   Authorized redirect URI you set in Google Cloud (step A.3).
5. Save.

> **Account linking:** By default Supabase links a Google login to an existing
> email/password account when the email is verified. Leave
> **Authentication > Providers > "Link accounts with the same email"** at its
> default unless you have a reason to change it.

> **Profiles:** Google users are created as **parents** with `full_name` from
> their Google profile and an **empty phone** (the `handle_new_user` trigger
> hard-codes `role = 'parent'` per migration 012). They can add a phone later in
> profile settings. Doctors/admins are still provisioned by an admin.

## Step 6: Configure Redirect URLs

1. Go to **Authentication** > **URL Configuration**
2. Add your site URLs to "Site URL":
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`
3. Add redirect URLs to "Redirect URLs":
   - `http://localhost:3000/auth/callback`
   - `https://yourdomain.com/auth/callback`

## Step 7: Install Dependencies

```bash
cd apps/web
pnpm install
```

## Step 8: Run the Application

```bash
# From the monorepo root
pnpm run dev

# Or from apps/web
cd apps/web
pnpm dev
```

The app should now be running at `http://localhost:3000`

## Step 9: Test Authentication

### Test Email/Password Signup:

1. Navigate to `http://localhost:3000/signup`
2. Fill in the form:
   - Full Name
   - Email
   - Phone
   - Password
   - Select role (Parent or Doctor)
3. Click "Create Account"
4. Check your email for verification link
5. Click the verification link
6. You should be redirected to the dashboard

### Test Email/Password Login:

1. Navigate to `http://localhost:3000/login`
2. Enter your email and password
3. Click "Sign In"
4. You should be redirected to the dashboard

### Test OTP Login:

1. Navigate to `http://localhost:3000/login`
2. Click on "OTP" tab
3. Enter your email
4. Click "Send OTP"
5. Check your email for the 6-digit code
6. Enter the OTP code
7. Click "Verify OTP"
8. You should be redirected to the dashboard

### Test Google Sign-In:

1. Navigate to `http://localhost:3000/login` (or `/signup`)
2. Click "Google" under "Or continue with"
3. Complete the Google consent screen
4. You should be redirected back through `/auth/callback` to the dashboard
5. First-time Google users are created as parents with an empty phone

## Step 10: Create Admin User

By default, all users are created as "parent" or "doctor". To create an admin:

1. Sign up a new user through the app
2. In Supabase dashboard, go to **SQL Editor**
3. Run this query (replace with actual user ID):

```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = 'user-uuid-from-auth-users-table';
```

To find the user ID:
1. Go to **Authentication** > **Users**
2. Click on the user
3. Copy their UUID

## Features Implemented

✅ **Email + Password Authentication**
- Secure password-based login
- Password strength validation (minimum 8 characters)

✅ **OTP (One-Time Password) Authentication**
- Magic link via email
- 6-digit verification code
- No password required

✅ **Google Sign-In (OAuth)**
- One-click login/signup with a Google account
- Reuses the PKCE `/auth/callback` and role-based redirect
- New Google users created as parents

✅ **Role-Based Access Control**
- Three roles: Parent, Doctor, Admin
- Role assigned during signup
- Role stored in profiles table

✅ **Email Verification**
- Users must verify email before full access
- Verification status shown in dashboard
- Automatic email sending via Supabase

✅ **Protected Routes**
- Middleware protects dashboard and role-specific routes
- Automatic redirect to login if not authenticated
- Automatic redirect to dashboard if already logged in

✅ **User Profile Management**
- Profile created automatically on signup
- Stores: name, phone, role
- Row Level Security (RLS) policies enabled

✅ **Modern UI**
- All forms use shadcn/ui components
- Responsive design
- Loading states and error handling
- Beautiful gradient backgrounds

## Security Features

- Row Level Security (RLS) enabled on all tables
- JWT-based session management
- Secure cookie handling
- HTTPS-only in production
- Protected API routes
- Email verification required

## Troubleshooting

### Email Not Sending

1. Check Supabase email rate limits (development: 4 emails/hour)
2. Configure custom SMTP in **Settings** > **Auth** > **SMTP Settings**
3. For production, use services like SendGrid, AWS SES, or Mailgun

### OTP Not Working

1. Ensure "Enable Email OTP" is turned on in Auth settings
2. Check email templates are configured correctly
3. Verify redirect URLs are added

### User Not Redirected After Signup

1. Check that callback URL is added to redirect URLs
2. Verify middleware is configured correctly
3. Check browser console for errors

### Profile Not Created

1. Check that the trigger `on_auth_user_created` exists
2. Verify RLS policies allow inserts
3. Check Supabase logs for errors

## Next Steps

Now that authentication is set up, you can proceed with:

1. **Phase 2**: Patient Management
   - Create child profiles
   - Manage medical records
   - Upload documents

2. **Phase 3**: Appointment System
   - Book consultations
   - Schedule appointments
   - Video integration

3. **Phase 4**: Payment System
   - Stripe integration
   - Package management
   - Invoice generation

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs
- Review Next.js docs: https://nextjs.org/docs
- Check shadcn/ui docs: https://ui.shadcn.com

## Database Schema Overview

```
┌─────────────────┐
│  auth.users     │ (Managed by Supabase)
│  - id           │
│  - email        │
│  - created_at   │
└────────┬────────┘
         │
         │ (1:1)
         │
┌────────┴────────────┐
│  profiles           │
│  - id (FK)          │
│  - full_name        │
│  - phone            │
│  - role             │
│  - created_at       │
│  - updated_at       │
└─────────────────────┘
```

## Role Permissions

| Role   | Permissions                                      |
|--------|--------------------------------------------------|
| Parent | Manage own children, book appointments, pay      |
| Doctor | Manage appointments, write medical notes         |
| Admin  | Full system access, manage all users             |
