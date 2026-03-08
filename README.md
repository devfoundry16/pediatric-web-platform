# Pediatric Telemedicine Platform

A secure, scalable online platform for pediatric consultations in Dubai, providing video consultations, digital medical records, appointment scheduling, and more.

## 🚀 Phase 1: Authentication - COMPLETED ✅

The authentication system has been fully implemented with the following features:

### Features

#### 1. Email + Password Authentication
- Secure password-based login
- Password strength validation (minimum 8 characters)
- Account creation with email verification

#### 2. OTP (One-Time Password) Authentication
- Magic link via email
- 6-digit verification code
- Passwordless login option

#### 3. Role-Based Access Control
- **Three User Roles:**
  - `parent` - Parents/Guardians managing children's health
  - `doctor` - Medical professionals providing consultations
  - `admin` - System administrators with full access
- Role assigned during signup
- Role-based route protection

#### 4. Email Verification
- Automatic verification email on signup
- Email confirmation required for account activation
- Verification status displayed in dashboard

#### 5. Password Management
- Forgot password functionality
- Secure password reset via email link
- Password update capability

#### 6. Protected Routes
- Middleware-based route protection
- Automatic redirect to login for unauthenticated users
- Automatic redirect to dashboard for authenticated users
- Session management with automatic refresh

#### 7. User Profile Management
- Profile automatically created on signup
- Stores: full name, phone, role
- Row Level Security (RLS) policies
- Update profile capability

### Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Forms:** React Hook Form + Zod validation
- **Styling:** Tailwind CSS v4
- **Authentication:** Supabase Auth (JWT-based)

### Project Structure

```
my-monorepo/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/
│   │   │   ├── (auth)/              # Auth pages (grouped route)
│   │   │   │   ├── login/           # Login page (Email + OTP)
│   │   │   │   ├── signup/          # Signup page with role selection
│   │   │   │   ├── forgot-password/ # Password reset request
│   │   │   │   └── layout.tsx       # Auth layout
│   │   │   ├── auth/
│   │   │   │   ├── callback/        # OAuth callback handler
│   │   │   │   └── reset-password/  # New password entry
│   │   │   ├── dashboard/           # Protected dashboard
│   │   │   ├── globals.css          # Global styles
│   │   │   ├── layout.tsx           # Root layout
│   │   │   └── page.tsx             # Home page
│   │   ├── components/
│   │   │   └── ui/                  # shadcn components
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts        # Browser Supabase client
│   │   │   │   └── server.ts        # Server Supabase client
│   │   │   └── types/
│   │   │       └── database.types.ts # TypeScript types
│   │   ├── middleware.ts            # Route protection
│   │   ├── .env.local               # Environment variables
│   │   └── package.json
│   └── api/                         # Express backend (ready for future features)
├── database/
│   └── schema.sql                   # Database schema & RLS policies
├── AUTH_SETUP.md                    # Detailed setup guide
└── README.md                        # This file
```

### Pages

| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/` | Home page with features overview | No |
| `/login` | Login page (Email/Password + OTP) | No |
| `/signup` | Signup page with role selection | No |
| `/forgot-password` | Request password reset | No |
| `/auth/callback` | OAuth callback handler | No |
| `/auth/reset-password` | Set new password | No |
| `/dashboard` | User dashboard | Yes |

### Database Schema

```sql
profiles
├── id (uuid, PK, FK to auth.users)
├── full_name (text)
├── phone (text)
├── role (text: 'parent' | 'doctor' | 'admin')
├── created_at (timestamp)
└── updated_at (timestamp)
```

### Security Features

- ✅ Row Level Security (RLS) on all tables
- ✅ JWT-based session management
- ✅ Secure cookie handling via middleware
- ✅ HTTPS-only in production
- ✅ Email verification required
- ✅ Password strength validation
- ✅ Protected API routes
- ✅ Automatic session refresh

## 📖 Setup Instructions

### Prerequisites

- Node.js 18+
- pnpm package manager
- Supabase account

### Quick Start

1. **Clone and Install**
   ```bash
   cd my-monorepo
   pnpm install
   ```

2. **Configure Supabase**
   - Create a Supabase project
   - Copy `.env.local` and add your credentials:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=your-project-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     ```

3. **Set Up Database**
   - Go to Supabase SQL Editor
   - Run `database/schema.sql`

4. **Configure Authentication**
   - Enable Email provider in Supabase Auth
   - Enable Email OTP
   - Add redirect URLs:
     - `http://localhost:3000/auth/callback`
   - Enable email confirmations

5. **Run Development Server**
   ```bash
   pnpm run dev
   ```

6. **Access the Application**
   - Open http://localhost:3000
   - Click "Get Started" to create an account
   - Check your email for verification

📚 **For detailed setup instructions, see [AUTH_SETUP.md](./AUTH_SETUP.md)**

## 🧪 Testing Authentication

### Test Accounts

Create test accounts with different roles:

1. **Parent Account**
   - Go to `/signup`
   - Select "Parent/Guardian" role
   - Complete registration

2. **Doctor Account**
   - Go to `/signup`
   - Select "Doctor" role
   - Complete registration

3. **Admin Account**
   - Create any account
   - In Supabase SQL Editor:
     ```sql
     UPDATE profiles SET role = 'admin' WHERE id = 'user-id';
     ```

### Test Scenarios

✅ Email/Password signup and login
✅ OTP-based login
✅ Email verification flow
✅ Password reset flow
✅ Protected route access
✅ Automatic redirects
✅ Role assignment
✅ Profile creation

## 🎨 UI Components

All forms use modern shadcn/ui components:

- `Button` - Primary actions
- `Input` - Text inputs
- `Label` - Form labels
- `Card` - Content containers
- `Alert` - Error/success messages
- `Tabs` - Login method switching
- `RadioGroup` - Role selection
- `InputOTP` - 6-digit code entry
- `Spinner` - Loading states

## 🔐 Security Best Practices

1. **Environment Variables**
   - Never commit `.env.local`
   - Use different keys for dev/prod

2. **Row Level Security**
   - All tables have RLS enabled
   - Users can only access their own data
   - Admins have elevated permissions

3. **Email Verification**
   - Required before full access
   - Prevents fake accounts

4. **Password Security**
   - Minimum 8 characters
   - Hashed by Supabase (bcrypt)
   - Never stored in plain text

## 📋 Next Phases

### Phase 2: Patient Management (Coming Soon)
- Create child profiles
- Manage medical records
- Upload documents
- View medical history

### Phase 3: Appointment System
- Book consultations
- Schedule appointments
- Video integration (Daily)
- Calendar management

### Phase 4: Payment System
- Stripe integration
- Consultation packages
- Invoice generation
- Payment history

### Phase 5: Live Sessions & Courses
- Group medical sessions
- Educational video courses
- Course enrollment
- Progress tracking

## 🛠️ Development Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start

# Lint code
pnpm run lint
```

## 📝 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Optional (for future phases)
STRIPE_SECRET_KEY=
DAILY_API_KEY=
```

## 🐛 Troubleshooting

### Email not sending
- Check Supabase email rate limits
- Configure custom SMTP for production

### Profile not created
- Verify database trigger exists
- Check RLS policies

### OTP not working
- Enable Email OTP in Auth settings
- Check redirect URLs

### Build errors
- Clear `.next` folder
- Reinstall dependencies: `pnpm install`

## 📞 Support

For questions or issues:
- Check `AUTH_SETUP.md` for detailed guides
- Review Supabase docs: https://supabase.com/docs
- Check Next.js docs: https://nextjs.org/docs

## 📄 License

Proprietary - All rights reserved

---

**Status:** Phase 1 (Authentication) - ✅ COMPLETED
**Next:** Phase 2 (Patient Management)
