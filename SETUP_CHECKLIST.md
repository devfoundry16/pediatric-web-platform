# Setup Checklist - Authentication Phase

Use this checklist to set up and test the authentication system.

## 🎯 Before You Start

Make sure you have:
- [ ] Node.js 18 or higher installed
- [ ] pnpm installed (`npm install -g pnpm`)
- [ ] A Supabase account (free tier is fine)
- [ ] An email account to receive verification emails

---

## 📋 Setup Steps

### 1️⃣ Supabase Project Setup

- [ ] Go to https://app.supabase.com
- [ ] Click "New Project"
- [ ] Fill in project details:
  - [ ] Project name: "Pediatric Telemedicine"
  - [ ] Database password: (generate and save securely)
  - [ ] Region: Choose closest to Dubai
- [ ] Click "Create new project"
- [ ] Wait for project to be ready (~2 minutes)

### 2️⃣ Get Supabase Credentials

- [ ] In Supabase dashboard, go to **Settings** → **API**
- [ ] Copy the following:
  - [ ] Project URL
  - [ ] Anon/Public key
- [ ] Keep these handy for next step

### 3️⃣ Configure Environment Variables

- [ ] Open `apps/web/.env.local` in your editor
- [ ] Replace the values:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
  ```
- [ ] Save the file

### 4️⃣ Set Up Database

- [ ] In Supabase dashboard, go to **SQL Editor**
- [ ] Click "New Query"
- [ ] Open `database/schema.sql` from this project
- [ ] Copy all contents
- [ ] Paste into SQL Editor
- [ ] Click "Run" or press Cmd/Ctrl + Enter
- [ ] Verify success (should see "Success. No rows returned")
- [ ] Go to **Table Editor** and verify `profiles` table exists

### 5️⃣ Configure Email Authentication

#### Enable Email Auth
- [ ] Go to **Authentication** → **Providers**
- [ ] Find "Email" provider
- [ ] Ensure it's enabled
- [ ] Click "Save"

#### Enable Email Confirmations
- [ ] Go to **Authentication** → **Settings**
- [ ] Scroll to "Email Auth"
- [ ] Enable "Confirm email"
- [ ] Save changes

#### Enable OTP
- [ ] In same section, find "Email OTP"
- [ ] Enable it
- [ ] Save changes

### 6️⃣ Configure Redirect URLs

- [ ] Go to **Authentication** → **URL Configuration**
- [ ] Under "Site URL", add:
  - [ ] `http://localhost:3000`
- [ ] Under "Redirect URLs", add:
  - [ ] `http://localhost:3000/auth/callback`
- [ ] Click "Save"

### 7️⃣ Customize Email Templates (Optional but Recommended)

- [ ] Go to **Authentication** → **Email Templates**
- [ ] Customize "Confirm signup" template:
  ```html
  <h2>Welcome to Pediatric Telemedicine!</h2>
  <p>Please confirm your email address by clicking the link below:</p>
  <p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
  ```
- [ ] Customize "Magic Link" template for OTP
- [ ] Save changes

### 8️⃣ Install Dependencies

- [ ] Open terminal in project root
- [ ] Run:
  ```bash
  cd my-monorepo
  pnpm install
  ```
- [ ] Wait for installation to complete
- [ ] Verify @supabase/ssr is installed

### 9️⃣ Start Development Server

- [ ] In terminal, run:
  ```bash
  pnpm run dev
  ```
- [ ] Wait for server to start
- [ ] Should see: "Local: http://localhost:3000"
- [ ] Open browser to http://localhost:3000

---

## ✅ Testing Checklist

### Test 1: Home Page
- [ ] Visit http://localhost:3000
- [ ] Verify page loads with:
  - [ ] "Pediatric Telemedicine Platform" heading
  - [ ] "Get Started" button
  - [ ] "Sign In" button
  - [ ] Three feature cards
- [ ] Check responsive design (resize browser)

### Test 2: Signup Flow
- [ ] Click "Get Started" or visit /signup
- [ ] Fill in the form:
  - [ ] Full Name: "Test User"
  - [ ] Email: Your real email
  - [ ] Phone: "+971501234567"
  - [ ] Select "Parent" role
  - [ ] Password: "testpass123"
  - [ ] Confirm Password: "testpass123"
- [ ] Click "Create Account"
- [ ] Should see success message
- [ ] Check your email
- [ ] Open verification email
- [ ] Click verification link
- [ ] Should redirect to login or dashboard

### Test 3: Email/Password Login
- [ ] Visit http://localhost:3000/login
- [ ] Ensure "Email & Password" tab is selected
- [ ] Enter credentials:
  - [ ] Email: (your test email)
  - [ ] Password: "testpass123"
- [ ] Click "Sign In"
- [ ] Should redirect to /dashboard
- [ ] Verify dashboard shows:
  - [ ] Your name
  - [ ] Your email
  - [ ] "Email Verified" with green checkmark
  - [ ] Role: "parent"
- [ ] Click "Sign Out"
- [ ] Should redirect to login

### Test 4: OTP Login
- [ ] Visit http://localhost:3000/login
- [ ] Click "OTP" tab
- [ ] Enter your email
- [ ] Click "Send OTP"
- [ ] Check your email for 6-digit code
- [ ] Enter the code in the OTP input
- [ ] Click "Verify OTP"
- [ ] Should redirect to /dashboard
- [ ] Sign out

### Test 5: Password Reset
- [ ] Visit http://localhost:3000/login
- [ ] Click "Forgot password?"
- [ ] Enter your email
- [ ] Click "Send Reset Link"
- [ ] Check your email
- [ ] Click reset link
- [ ] Should redirect to /auth/reset-password
- [ ] Enter new password: "newpass123"
- [ ] Confirm password: "newpass123"
- [ ] Click "Reset Password"
- [ ] Should redirect to login
- [ ] Login with new password
- [ ] Should work

### Test 6: Protected Routes
- [ ] While logged out, try to visit /dashboard
- [ ] Should redirect to /login
- [ ] Login
- [ ] Should redirect back to /dashboard
- [ ] While logged in, try to visit /login
- [ ] Should redirect to /dashboard

### Test 7: Doctor Signup
- [ ] Logout
- [ ] Go to /signup
- [ ] Create account with "Doctor" role
- [ ] Verify email
- [ ] Login
- [ ] Dashboard should show role: "doctor"

### Test 8: Mobile Responsiveness
- [ ] Open DevTools (F12)
- [ ] Toggle device toolbar
- [ ] Test on:
  - [ ] iPhone SE (375px)
  - [ ] iPad (768px)
  - [ ] Desktop (1920px)
- [ ] Verify all pages look good on all sizes

### Test 9: Error Handling
- [ ] Try to login with wrong password
  - [ ] Should show error message
- [ ] Try to signup with existing email
  - [ ] Should show error message
- [ ] Try OTP with wrong code
  - [ ] Should show error message

### Test 10: Loading States
- [ ] Check that buttons show spinners while loading
- [ ] Check that inputs are disabled during submission
- [ ] Verify smooth transitions

---

## 🔧 Troubleshooting

### Issue: "Invalid Supabase URL or key"
**Solution:**
- [ ] Double-check `.env.local` file
- [ ] Ensure no extra spaces in URL or key
- [ ] Restart dev server: `Ctrl+C` then `pnpm run dev`

### Issue: Email not received
**Solution:**
- [ ] Check spam folder
- [ ] Verify email is enabled in Supabase settings
- [ ] Check Supabase rate limits (4 emails/hour in dev)
- [ ] Try with different email address

### Issue: "Failed to create profile"
**Solution:**
- [ ] Go to Supabase SQL Editor
- [ ] Verify trigger exists:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
  ```
- [ ] If not found, re-run `database/schema.sql`

### Issue: Dashboard shows blank profile
**Solution:**
- [ ] Go to Supabase Table Editor
- [ ] Open `profiles` table
- [ ] Verify your profile exists
- [ ] If not, manually insert:
  ```sql
  INSERT INTO profiles (id, full_name, phone, role)
  VALUES ('your-user-id', 'Your Name', 'Phone', 'parent');
  ```

### Issue: Build errors
**Solution:**
- [ ] Delete `.next` folder: `rm -rf .next`
- [ ] Clear node_modules: `rm -rf node_modules`
- [ ] Reinstall: `pnpm install`
- [ ] Rebuild: `pnpm run dev`

### Issue: TypeScript errors
**Solution:**
- [ ] Run type check: `pnpm run check-types`
- [ ] Fix reported errors
- [ ] Restart TypeScript server in your editor

---

## 🎯 Success Criteria

You've successfully set up authentication when:

- ✅ Home page loads without errors
- ✅ Can create account with email/password
- ✅ Receive verification email
- ✅ Can verify email address
- ✅ Can login with email/password
- ✅ Can login with OTP
- ✅ Can reset password
- ✅ Dashboard shows correct user info
- ✅ Protected routes require authentication
- ✅ Can logout successfully
- ✅ Role is assigned correctly (parent/doctor)
- ✅ All pages are responsive
- ✅ No console errors in browser

---

## 🚀 Next Steps

Once all tests pass:

1. **Production Setup (Optional for now):**
   - [ ] Configure custom SMTP in Supabase
   - [ ] Set up custom domain
   - [ ] Deploy to Vercel/Netlify
   - [ ] Update redirect URLs for production

2. **Create Admin User (Optional):**
   - [ ] Create a regular account
   - [ ] Get user ID from Supabase Auth > Users
   - [ ] Run in SQL Editor:
     ```sql
     UPDATE profiles SET role = 'admin' WHERE id = 'user-id-here';
     ```

3. **Begin Phase 2 - Patient Management:**
   - [ ] Read `README.md` for Phase 2 requirements
   - [ ] Review patient management features
   - [ ] Start implementing child profiles

---

## 📚 Documentation Reference

- **Quick Start:** `QUICKSTART.md`
- **Detailed Setup:** `AUTH_SETUP.md`
- **Flow Diagrams:** `AUTH_FLOW_DIAGRAM.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`
- **Full Project Docs:** `README.md`

---

## ✨ Tips

- **Email Verification:** In development, check your spam folder
- **OTP Codes:** Valid for 60 seconds
- **Rate Limits:** Free tier has 4 emails/hour limit
- **Custom SMTP:** Set up for production to avoid limits
- **Console Logs:** Check browser console for helpful debug info
- **Supabase Logs:** Check Supabase dashboard for server-side logs

---

**Last Updated:** February 9, 2026
**Phase:** 1 - Authentication
**Status:** Ready for Testing
