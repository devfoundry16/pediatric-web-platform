# Quick Start Guide - Authentication Implementation

## What Was Implemented

✅ **Complete Authentication System** using Supabase Auth
- Email/Password login and signup
- OTP (Magic Link) authentication
- Role-based access (Parent, Doctor, Admin)
- Email verification
- Password reset functionality
- Protected routes with middleware
- User profile management
- Beautiful UI with shadcn components

## Files Created

### Configuration Files
- `apps/web/.env.local` - Environment variables (needs your Supabase credentials)
- `apps/web/.env.example` - Template for environment variables
- `apps/web/middleware.ts` - Route protection and session management
- `apps/api/.env.example` - Backend environment template

### Supabase Clients
- `apps/web/lib/supabase/client.ts` - Browser Supabase client
- `apps/web/lib/supabase/server.ts` - Server-side Supabase client

### Type Definitions
- `apps/web/lib/types/database.types.ts` - TypeScript types for database

### Authentication Pages
- `apps/web/app/(auth)/login/page.tsx` - Login page (Email/Password + OTP)
- `apps/web/app/(auth)/signup/page.tsx` - Signup with role selection
- `apps/web/app/(auth)/forgot-password/page.tsx` - Password reset request
- `apps/web/app/(auth)/layout.tsx` - Auth pages layout

### Auth Callbacks
- `apps/web/app/auth/callback/route.ts` - OAuth callback handler
- `apps/web/app/auth/reset-password/page.tsx` - Password reset form

### Protected Pages
- `apps/web/app/dashboard/page.tsx` - User dashboard (protected)

### Database
- `database/schema.sql` - Complete database schema with RLS policies

### Documentation
- `AUTH_SETUP.md` - Detailed setup instructions
- `README.md` - Project overview
- `QUICKSTART.md` - This file

## Setup in 5 Minutes

### 1. Create Supabase Project
```bash
# Go to https://app.supabase.com
# Click "New Project"
# Note your project URL and anon key
```

### 2. Configure Environment
```bash
# Edit apps/web/.env.local and add your credentials:
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set Up Database
```bash
# In Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Copy contents of database/schema.sql
# 3. Paste and run
```

### 4. Configure Auth Settings
```bash
# In Supabase Dashboard > Authentication > Settings:
# 1. Enable "Email Auth"
# 2. Enable "Email OTP"
# 3. Enable "Confirm email"

# In URL Configuration:
# Add redirect URL: http://localhost:3000/auth/callback
```

### 5. Install and Run
```bash
cd my-monorepo
pnpm install
pnpm run dev
```

### 6. Test It Out
```bash
# Open http://localhost:3000
# Click "Get Started"
# Create an account
# Check your email for verification
```

## Project Structure

```
my-monorepo/
├── apps/
│   ├── web/                     # Next.js frontend
│   │   ├── app/
│   │   │   ├── (auth)/         # Auth pages (login, signup)
│   │   │   ├── auth/           # Auth callbacks
│   │   │   ├── dashboard/      # Protected pages
│   │   │   └── page.tsx        # Home page
│   │   ├── lib/
│   │   │   ├── supabase/       # Supabase clients
│   │   │   └── types/          # TypeScript types
│   │   └── middleware.ts       # Route protection
│   └── api/                    # Express backend (ready for future)
├── database/
│   └── schema.sql              # Database schema
├── AUTH_SETUP.md               # Detailed guide
├── README.md                   # Full documentation
└── QUICKSTART.md               # This file
```

## Key Features

### 1. Dual Authentication Methods
**Email/Password:**
- Traditional login with password
- Password strength validation
- "Remember me" functionality

**OTP (One-Time Password):**
- Passwordless authentication
- 6-digit verification code
- Sent via email

### 2. Role-Based Access Control
**Three Roles:**
- `parent` - Default for parents/guardians
- `doctor` - For medical professionals
- `admin` - Full system access

**Access Control:**
- Middleware protects routes
- Automatic redirects based on auth state
- Role-specific permissions via RLS

### 3. Email Verification
- Verification email sent on signup
- Account must be verified before full access
- Resend verification email option

### 4. Password Management
- Forgot password flow
- Secure reset via email link
- Password strength requirements

### 5. Protected Routes
```
Public Routes:
✓ / (home)
✓ /login
✓ /signup
✓ /forgot-password

Protected Routes (require auth):
🔒 /dashboard
🔒 /parent/* (future)
🔒 /doctor/* (future)
🔒 /admin/* (future)
```

### 6. Security Features
- Row Level Security (RLS) enabled
- JWT-based sessions
- Secure cookie handling
- HTTPS in production
- Password hashing (bcrypt)
- Email verification required

## Testing the Implementation

### Test Email/Password Authentication
1. Go to http://localhost:3000/signup
2. Fill in the form:
   - Full Name: "Test User"
   - Email: "test@example.com"
   - Phone: "+971501234567"
   - Role: "Parent"
   - Password: "password123"
3. Click "Create Account"
4. Check email for verification link
5. Click verification link
6. Go to http://localhost:3000/login
7. Login with email and password
8. Should redirect to dashboard

### Test OTP Authentication
1. Go to http://localhost:3000/login
2. Click "OTP" tab
3. Enter email address
4. Click "Send OTP"
5. Check email for 6-digit code
6. Enter the code
7. Click "Verify OTP"
8. Should redirect to dashboard

### Test Protected Routes
1. Logout from dashboard
2. Try to access http://localhost:3000/dashboard
3. Should redirect to login page
4. Login again
5. Try to access http://localhost:3000/login
6. Should redirect to dashboard

### Test Password Reset
1. Go to http://localhost:3000/forgot-password
2. Enter email address
3. Check email for reset link
4. Click reset link
5. Enter new password
6. Should redirect to login
7. Login with new password

## Common Issues & Solutions

### Issue: Email not sending
**Solution:**
- Check Supabase email rate limits (4 emails/hour in dev)
- Configure custom SMTP in Supabase settings
- Use a real email service for production

### Issue: OTP not working
**Solution:**
- Enable "Email OTP" in Supabase Auth settings
- Check redirect URLs are configured
- Verify email templates

### Issue: Profile not created
**Solution:**
- Check database trigger exists: `on_auth_user_created`
- Verify RLS policies allow inserts
- Check Supabase logs for errors

### Issue: Middleware errors
**Solution:**
- Ensure @supabase/ssr is installed
- Check environment variables are set
- Restart dev server

### Issue: Build errors
**Solution:**
```bash
rm -rf .next
pnpm install
pnpm run dev
```

## What's Next?

Now that authentication is complete, you can proceed with:

### Phase 2: Patient Management
- Create child profiles
- Medical history forms
- Document uploads
- View medical records

### Phase 3: Appointment System
- Book consultations
- Video calls integration (Daily)
- Calendar management
- Appointment notifications

### Phase 4: Payments
- Stripe integration
- Consultation packages
- Payment history
- Invoice generation

## Environment Variables Reference

### Frontend (apps/web/.env.local)
```env
# Required now
NEXT_PUBLIC_SUPABASE_URL=         # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Your Supabase anon key

# Required later
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # Stripe public key (Phase 4)
NEXT_PUBLIC_API_URL=                 # Backend API URL (if needed)
```

### Backend (apps/api/.env)
```env
# Required later
PORT=4000                          # API server port
NODE_ENV=DEVELOPMENT              # Environment
FRONTEND_URL=http://localhost:3000 # Frontend URL for CORS
SUPABASE_URL=                     # Supabase URL
SUPABASE_SERVICE_ROLE_KEY=        # Service role key for admin operations
```

## Support

- **Detailed Setup:** See `AUTH_SETUP.md`
- **Full Documentation:** See `README.md`
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **shadcn/ui Docs:** https://ui.shadcn.com

## Summary

✅ Authentication system is complete and production-ready
✅ All pages use shadcn components (no native HTML inputs)
✅ Role-based access control implemented
✅ Email verification enabled
✅ OTP authentication available
✅ Protected routes with middleware
✅ Database schema with RLS policies
✅ Password reset functionality
✅ Beautiful, responsive UI

**Status:** Phase 1 Complete - Ready for Phase 2 (Patient Management)
