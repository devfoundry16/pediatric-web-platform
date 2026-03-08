# Authentication Flow Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User's Browser                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐   │
│  │   Home     │  │   Login    │  │     Signup         │   │
│  │   Page     │  │   Page     │  │     Page           │   │
│  └────────────┘  └────────────┘  └────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP/HTTPS
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   Next.js App (Port 3000)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Middleware.ts                           │  │
│  │  • Session validation                                 │  │
│  │  • Route protection                                   │  │
│  │  • Automatic redirects                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Supabase Client (Browser)                    │  │
│  │  • auth.signUp()                                      │  │
│  │  • auth.signInWithPassword()                          │  │
│  │  • auth.signInWithOtp()                               │  │
│  │  • auth.signOut()                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ API Calls
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                  Supabase (Cloud)                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Auth Service                         │  │
│  │  • User authentication                                │  │
│  │  • JWT token generation                               │  │
│  │  • Email verification                                 │  │
│  │  • Password hashing                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             PostgreSQL Database                       │  │
│  │  ┌─────────────┐    ┌──────────────┐                │  │
│  │  │ auth.users  │────│   profiles   │                 │  │
│  │  │ (managed)   │    │  (custom)    │                 │  │
│  │  └─────────────┘    └──────────────┘                 │  │
│  │       • RLS Policies                                  │  │
│  │       • Triggers                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                Email Service                          │  │
│  │  • Verification emails                                │  │
│  │  • OTP codes                                          │  │
│  │  • Password reset                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## User Signup Flow

```
┌──────────┐
│  Start   │
└────┬─────┘
     │
     ↓
┌──────────────────────┐
│ User visits /signup  │
└────┬─────────────────┘
     │
     ↓
┌─────────────────────────┐
│ Fills registration form │
│ • Full Name             │
│ • Email                 │
│ • Phone                 │
│ • Role (Parent/Doctor)  │
│ • Password              │
└────┬────────────────────┘
     │
     ↓
┌──────────────────────────┐
│ Click "Create Account"   │
└────┬─────────────────────┘
     │
     ↓
┌──────────────────────────┐     ┌─────────────────┐
│ Supabase creates user in │────→│  Email sent to  │
│ auth.users table         │     │  verify account │
└────┬─────────────────────┘     └─────────────────┘
     │
     ↓
┌──────────────────────────┐
│ Trigger auto-creates     │
│ profile in profiles table│
└────┬─────────────────────┘
     │
     ↓
┌──────────────────────────┐
│ Success message shown    │
│ "Check your email"       │
└────┬─────────────────────┘
     │
     ↓
┌──────────────────────────┐
│ User checks email and    │
│ clicks verification link │
└────┬─────────────────────┘
     │
     ↓
┌──────────────────────────┐
│ Email verified ✓         │
│ Redirected to login      │
└────┬─────────────────────┘
     │
     ↓
┌──────────┐
│   Done   │
└──────────┘
```

## Email/Password Login Flow

```
┌──────────┐
│  Start   │
└────┬─────┘
     │
     ↓
┌──────────────────────┐
│ User visits /login   │
│ (Email/Password tab) │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐
│ Enters credentials   │
│ • Email              │
│ • Password           │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐
│ Click "Sign In"      │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐         ┌─────────────────┐
│ Supabase validates   │────No──→│ Show error      │
│ credentials          │         │ message         │
└────┬─────────────────┘         └─────────────────┘
     │ Yes
     ↓
┌──────────────────────┐
│ JWT token generated  │
│ Session created      │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐
│ Middleware validates │
│ session              │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐
│ Redirected to        │
│ /dashboard           │
└────┬─────────────────┘
     │
     ↓
┌──────────┐
│   Done   │
└──────────┘
```

## OTP Login Flow

```
┌──────────┐
│  Start   │
└────┬─────┘
     │
     ↓
┌──────────────────────┐
│ User visits /login   │
│ (OTP tab)            │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐
│ Enters email address │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐
│ Click "Send OTP"     │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐     ┌─────────────────────┐
│ Supabase generates   │────→│ Email sent with     │
│ 6-digit OTP code     │     │ verification code   │
└────┬─────────────────┘     └─────────────────────┘
     │
     ↓
┌──────────────────────┐
│ User checks email    │
│ and copies code      │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐
│ Enters 6-digit code  │
│ in OTP input         │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐
│ Click "Verify OTP"   │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐         ┌─────────────────┐
│ Supabase validates   │────No──→│ Show error      │
│ OTP code             │         │ "Invalid code"  │
└────┬─────────────────┘         └─────────────────┘
     │ Yes
     ↓
┌──────────────────────┐
│ JWT token generated  │
│ Session created      │
└────┬─────────────────┘
     │
     ↓
┌──────────────────────┐
│ Redirected to        │
│ /dashboard           │
└────┬─────────────────┘
     │
     ↓
┌──────────┐
│   Done   │
└──────────┘
```

## Password Reset Flow

```
┌──────────┐
│  Start   │
└────┬─────┘
     │
     ↓
┌────────────────────────┐
│ User clicks "Forgot    │
│ Password?" on login    │
└────┬───────────────────┘
     │
     ↓
┌────────────────────────┐
│ Redirected to          │
│ /forgot-password       │
└────┬───────────────────┘
     │
     ↓
┌────────────────────────┐
│ Enters email address   │
└────┬───────────────────┘
     │
     ↓
┌────────────────────────┐
│ Click "Send Reset Link"│
└────┬───────────────────┘
     │
     ↓
┌────────────────────────┐     ┌─────────────────────┐
│ Supabase generates     │────→│ Email sent with     │
│ secure reset token     │     │ reset link          │
└────┬───────────────────┘     └─────────────────────┘
     │
     ↓
┌────────────────────────┐
│ User checks email and  │
│ clicks reset link      │
└────┬───────────────────┘
     │
     ↓
┌────────────────────────┐
│ Redirected to          │
│ /auth/reset-password   │
└────┬───────────────────┘
     │
     ↓
┌────────────────────────┐
│ Enters new password    │
│ (twice for confirm)    │
└────┬───────────────────┘
     │
     ↓
┌────────────────────────┐
│ Click "Reset Password" │
└────┬───────────────────┘
     │
     ↓
┌────────────────────────┐         ┌─────────────────┐
│ Supabase validates     │────No──→│ Show error      │
│ token & updates pwd    │         │ message         │
└────┬───────────────────┘         └─────────────────┘
     │ Yes
     ↓
┌────────────────────────┐
│ Password updated ✓     │
│ Redirected to login    │
└────┬───────────────────┘
     │
     ↓
┌──────────┐
│   Done   │
└──────────┘
```

## Protected Route Access

```
┌──────────┐
│  Start   │
└────┬─────┘
     │
     ↓
┌────────────────────────┐
│ User tries to access   │
│ /dashboard             │
└────┬───────────────────┘
     │
     ↓
┌────────────────────────┐
│ Middleware intercepts  │
│ request                │
└────┬───────────────────┘
     │
     ↓
┌────────────────────────┐
│ Check for valid        │
│ session/JWT token      │
└────┬───────────────────┘
     │
     ↓
    / \
   /   \
  /Valid?\
 /       \
└─────────┘
 │       │
No       Yes
 │       │
 ↓       ↓
┌────────────────────┐  ┌────────────────────┐
│ Redirect to login  │  │ Allow access to    │
│ with return URL    │  │ /dashboard         │
│ ?redirect=/dash    │  │                    │
└────────────────────┘  └────────┬───────────┘
                                 │
                                 ↓
                        ┌────────────────────┐
                        │ Load user profile  │
                        │ from database      │
                        └────────┬───────────┘
                                 │
                                 ↓
                        ┌────────────────────┐
                        │ Render dashboard   │
                        │ with user data     │
                        └────────────────────┘
```

## Database Relationships

```
┌─────────────────────────────────────────────────┐
│              auth.users (Supabase)              │
│  ┌──────────────────────────────────────────┐  │
│  │  id (uuid, PK)                           │  │
│  │  email (unique)                          │  │
│  │  encrypted_password                      │  │
│  │  email_confirmed_at                      │  │
│  │  raw_user_meta_data                      │  │
│  │  created_at                               │  │
│  └──────────────┬───────────────────────────┘  │
└─────────────────┼───────────────────────────────┘
                  │
                  │ Foreign Key (id)
                  │ ON DELETE CASCADE
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│           public.profiles (Custom)              │
│  ┌──────────────────────────────────────────┐  │
│  │  id (uuid, PK, FK)                       │  │
│  │  full_name (text)                        │  │
│  │  phone (text)                            │  │
│  │  role (text)                             │  │
│  │    • 'parent'                            │  │
│  │    • 'doctor'                            │  │
│  │    • 'admin'                             │  │
│  │  created_at (timestamp)                  │  │
│  │  updated_at (timestamp)                  │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  RLS Policies:                                  │
│  • Users can view own profile                   │
│  • Users can update own profile                 │
│  • Admins can view all profiles                 │
│  • Admins can update all profiles               │
└─────────────────────────────────────────────────┘
```

## Security Layers

```
┌───────────────────────────────────────────────┐
│         Layer 1: Transport Security           │
│              HTTPS/TLS Encryption             │
└──────────────────┬────────────────────────────┘
                   │
                   ↓
┌───────────────────────────────────────────────┐
│      Layer 2: Authentication (Supabase)       │
│  • JWT token validation                       │
│  • Session management                         │
│  • Password hashing (bcrypt)                  │
└──────────────────┬────────────────────────────┘
                   │
                   ↓
┌───────────────────────────────────────────────┐
│     Layer 3: Authorization (Middleware)       │
│  • Route protection                           │
│  • Role checking                              │
│  • Automatic redirects                        │
└──────────────────┬────────────────────────────┘
                   │
                   ↓
┌───────────────────────────────────────────────┐
│    Layer 4: Data Access (RLS Policies)        │
│  • Row-level security                         │
│  • User-scoped queries                        │
│  • Admin-only operations                      │
└──────────────────┬────────────────────────────┘
                   │
                   ↓
┌───────────────────────────────────────────────┐
│     Layer 5: Data Storage (PostgreSQL)        │
│  • Encrypted at rest                          │
│  • Regular backups                            │
│  • Audit logging                              │
└───────────────────────────────────────────────┘
```

## Role-Based Access Control

```
┌─────────────────────────────────────────────────────┐
│                    Admin Role                       │
│  • Full system access                               │
│  • View all users                                   │
│  • Update all profiles                              │
│  • Manage appointments (future)                     │
│  • Configure system (future)                        │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ Inherits all permissions
                  │
        ┌─────────┴─────────┐
        │                   │
        ↓                   ↓
┌───────────────────┐  ┌───────────────────┐
│   Doctor Role     │  │   Parent Role     │
│                   │  │                   │
│ • View own        │  │ • View own        │
│   profile         │  │   profile         │
│ • Update own      │  │ • Update own      │
│   profile         │  │   profile         │
│ • View assigned   │  │ • Manage own      │
│   patients        │  │   children        │
│   (future)        │  │   (future)        │
│ • Write medical   │  │ • Book            │
│   notes (future)  │  │   appointments    │
│ • Manage          │  │   (future)        │
│   appointments    │  │ • View medical    │
│   (future)        │  │   records         │
│                   │  │   (future)        │
└───────────────────┘  └───────────────────┘
```

---

## Quick Reference

### Key URLs
- **Home:** http://localhost:3000
- **Login:** http://localhost:3000/login
- **Signup:** http://localhost:3000/signup
- **Dashboard:** http://localhost:3000/dashboard (protected)
- **Forgot Password:** http://localhost:3000/forgot-password

### Key Files
- **Middleware:** `apps/web/middleware.ts`
- **Client:** `apps/web/lib/supabase/client.ts`
- **Server:** `apps/web/lib/supabase/server.ts`
- **Schema:** `database/schema.sql`

### Key Commands
```bash
# Start dev server
pnpm run dev

# Build for production
pnpm run build

# Run linter
pnpm run lint
```
