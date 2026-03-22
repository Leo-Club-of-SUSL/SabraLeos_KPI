# SabraLeos - Leo Club Points Tracker

A production-ready Progressive Web App (PWA) for tracking member contributions and service points for the Leo Club of Sabaragamuwa University.

## Features

### Core Functionality

- **Member Management**: Complete member registry with profiles, photos, and contact information
- **Contribution Tracking**: Log and track member contributions with automatic points calculation
- **Advanced Reporting**: Filter members by date range, project count, and faculty
- **User Management**: Role-based access control (Super Admin, Editor, Viewer)
- **Member Lookup**: Quick search by University Registration Number
- **Leaderboard**: Real-time top contributors display

### Technical Features

- **Progressive Web App**: Install on mobile devices for native-like experience
- **Dark Mode**: Full dark/light theme support with persistent preferences
- **Responsive Design**: Mobile-first design that works on all screen sizes
- **Real-time Updates**: Automatic point calculation via database triggers
- **Type Safety**: Full TypeScript implementation
- **Secure Authentication**: Supabase Auth with Row Level Security (RLS)

## Tech Stack

- **Framework**: React 18 with Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **State Management**: React Context API

## Design System

### Colors

- **Primary**: Maroon (#800000) - Represents Leo Club's official colors
- **Secondary**: Gold (#FFD700) - Accent color for achievements
- **Background**: Clean White/Slate (Light Mode), Deep Gray (Dark Mode)

### Typography

- Professional, clean fonts suitable for university setting
- Clear hierarchy with proper heading levels
- Optimized line spacing for readability

### UI Components

- Modern card-based layouts
- Smooth transitions and hover states
- Clear visual feedback for all interactions
- Accessible form inputs with proper labels

## Project Structure

```
nexus/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── AddContributionForm.tsx
│   │   ├── Layout.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── Navbar.tsx
│   │   └── NewMemberForm.tsx
│   ├── contexts/          # React Context providers
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── lib/               # Core utilities
│   │   ├── db-init.ts
│   │   └── supabase.ts
│   ├── pages/             # Main application pages
│   │   ├── Dashboard.tsx
│   │   ├── Members.tsx
│   │   ├── Reports.tsx
│   │   └── UserManagement.tsx
│   ├── services/          # Business logic layer
│   │   ├── contribution-service.ts
│   │   ├── member-service.ts
│   │   └── user-service.ts
│   ├── types/             # TypeScript type definitions
│   │   └── database.ts
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # Application entry point
│   └── index.css          # Global styles
├── public/
│   └── manifest.json      # PWA manifest
├── documentation/         # Documentation folder
│   ├── index.md           # Master documentation index
│   ├── architecture.md    # System architecture
│   ├── database_schema.md # DB schema & security
│   ├── api_services.md    # API and services map
│   ├── components.md      # React components overview
│   ├── DATABASE_SETUP.md  # Database setup guide
│   ├── PROJECT_SUMMARY.md # Project summary
│   ├── QUICK_START.md     # Quick start guide
│   ├── DISABLE_EMAIL_CONFIRMATION.md # Role config
│   └── USER_DELETION_GUIDE.md # Account management
└── README.md              # This file
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nexus
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up database**

   Follow the instructions in `documentation/DATABASE_SETUP.md` to set up your Supabase database tables and create your first admin user.

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

### First-Time Setup

After setting up the database:

1. Log in with your admin credentials
2. Create additional users via User Management
3. Link user accounts to member records
4. Start adding members and tracking contributions

## User Roles

### Super Admin
- Create and manage user accounts
- Full access to all features
- Can link users to member records

### Editor (Director)
- Add and edit members
- Log contributions and points
- View all reports
- Cannot manage users

### Viewer
- Read-only access
- View dashboard statistics
- Access member profiles
- View reports

## Key Workflows

### 1. Member Lookup & Points Addition

1. Navigate to Members page
2. Enter University Reg No
3. If member exists: View profile and add contribution
4. If member not found: Register new member

### 2. Adding Contributions

1. Search for member
2. Click "Add Contribution"
3. Fill in project details:
   - Project name
   - Time period
   - Position/Role
   - Points (manual entry)
   - Avenue (optional)
4. Points automatically update member's total

### 3. Generating Reports

1. Navigate to Reports page
2. Apply filters:
   - Date range
   - Minimum project count
   - Faculty
3. View filtered results
4. Export to CSV for external use

### 4. User Management (Super Admin Only)

1. Navigate to User Management
2. Click "Create User"
3. Enter user details
4. Select role
5. Optionally link to member record
6. User receives account credentials

## Critical Features

### Linked User-Member System

The system links app users (board members) to their member records via University Reg No. This ensures that board members who are also Leo Club members can accumulate points for their own contributions.

**How it works:**
1. When creating a user, optionally select their member record
2. The user's account is linked to their member profile
3. Any contributions they log for themselves are properly tracked
4. Their points appear on the leaderboard

### Automatic Points Calculation

Points are automatically recalculated whenever contributions are added, updated, or deleted via database triggers. This ensures data integrity and real-time accuracy.

### Photo Upload

Members can have profile photos uploaded during registration. The system uses:
- File preview before upload
- Circular display format
- Fallback to initials if no photo

### Advanced Filtering

The Reports page supports complex filtering:
- **Date range**: Filter contributions within specific periods
- **Project count**: Find members with minimum X projects
- **Faculty**: Filter by academic faculty
- **Export**: Download filtered results as CSV

## Security

### Row Level Security (RLS)

All database tables use Supabase RLS policies to ensure:
- Users can only access data they're authorized to see
- Super Admins can manage users
- Editors can modify members and contributions
- Viewers have read-only access
- Data integrity is maintained

### Authentication

- Secure email/password authentication via Supabase
- Session management with automatic refresh
- Protected routes based on user role
- Logout functionality on all devices

## Progressive Web App (PWA)

### Installation

Users can install SabraLeos as a PWA:
1. Visit the app in a mobile browser
2. Tap "Add to Home Screen"
3. App opens in standalone mode (no browser UI)

### Benefits

- Works offline (when configured)
- Native-like experience
- Fast loading times
- Push notifications (future feature)

## Development

### Running Locally

```bash
npm run dev
```

Visit `http://localhost:5173`

### Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Database Schema

### members
- Primary Key: `reg_no` (University Registration Number)
- Stores member profiles, contact info, and total points
- Auto-updated `updated_at` timestamp

### contributions
- Primary Key: `id` (UUID)
- Foreign Key: `member_reg_no` → members
- Tracks individual project contributions
- Automatically updates member's total_points

### app_users
- Primary Key: `id` (references auth.users)
- Foreign Key: `linked_member_reg_no` → members
- Stores user roles and designations
- Links system users to member records

## Future Enhancements

Potential features for future versions:

- [ ] Push notifications for new contributions
- [ ] Bulk import members via CSV
- [ ] QR code member lookup
- [ ] Photo gallery for projects
- [ ] Advanced analytics dashboard
- [ ] Email notifications
- [ ] Member attendance tracking
- [ ] Event management system
- [ ] Mobile app (React Native)

## Troubleshooting

### Database not initializing

1. Check Supabase project is running
2. Verify environment variables in `.env`
3. Run the SQL migration script manually
4. Check browser console for errors

### Login fails

1. Verify user exists in Supabase Auth
2. Check user has corresponding app_users record
3. Verify RLS policies are enabled
4. Check network connection

### Photos not uploading

1. Create a storage bucket named "members" in Supabase
2. Set appropriate storage policies
3. Check file size limits
4. Verify browser has file access permissions

## Support

For issues or questions:

1. Check the documentation/DATABASE_SETUP.md guide
2. Review Supabase dashboard for errors
3. Check browser console for error messages
4. Verify all dependencies are installed

## License

This project is created for the Leo Club of Sabaragamuwa University.

## Acknowledgments

- Leo Club of Sabaragamuwa University
- Supabase for backend infrastructure
- React and Vite teams for excellent development tools
- Tailwind CSS for the design system
- Lucide for beautiful icons
