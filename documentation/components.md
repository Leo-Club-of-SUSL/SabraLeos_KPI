# Component Documentation

The SabraLeos KPI System heavily relies on distinct, reusable, and type-checked React Function Components to deliver a cohesive experience.

## Pages Layer

Pages aggregate smaller components, establish complex local state, and act as macro-level views in the Routing index.

1. **`Dashboard.tsx`**
   - The primary landing zone post-authentication.
   - Presents quick statistics: Total Members, Core Contributions, Outstanding Points.
   - Displays real-time Leaderboards referencing `total_points` from the database.

2. **`Members.tsx`**
   - Implements a complex Member Directory with comprehensive search and filtering pipelines.
   - Embeds forms or modals like `NewMemberForm.tsx` via state handlers.
   - Acts as the portal to examine specific user profiles.

3. **`Reports.tsx`**
   - Advanced UI that allows specific parameter filters (Dates, Projects, Avenues).
   - Contains extensive logic chaining via JS functional programming (`filter`, `map`, `reduce`) to refine datasets dynamically.
   - Handles the conversion of JSON data buffers to CSV binaries.

4. **`UserManagement.tsx`**
   - Restricted route exclusively visible to `Super Admin`.
   - Iterates through the list of system users and provides role adjustments.

## Core Component Layer

Components encapsulate repeated styling patterns strictly using Tailwind CSS utility classes and ensure UI consistency.

1. **`Navbar.tsx` & `Layout.tsx`**
   - The outer shell of the application.
   - Embeds navigation sublinks and statefully toggles the responsive mobile-hamburger drawer.
   - Contains the Light/Dark mode interaction handle wrapping `ThemeContext`.

2. **`AddContributionForm.tsx` & `EditMemberForm.tsx`**
   - Stateful dialogs utilizing internal forms.
   - Contain extensive client-side data validation to reject malformed payloads before they communicate with `services`.

3. **`LoginScreen.tsx`**
   - Implements authentication workflows using the `AuthContext` to validate users.
   - Redirects authenticated profiles into the application router.

4. **`BulkImportModal.tsx` & `ExportOptionsModal.tsx`**
   - Specialized interactive modals wrapping file ingestion (`bulk-import-service`) and data ejection modules (`Reports.tsx`).
   - Parses UI files into Blobs/Buffers.

## Global Context Layer

React's functional propagation mechanism to deploy localized context across nested trees universally.

1. **`AuthContext.tsx`**
   - Initializes upon application mount. Reaches out to Supabase SDK to retrieve the active Session token.
   - Emits global state constants like `user`, `role`, and `isLoading`.
   - Embeds helper functions like `signIn` and `signOut`.

2. **`ThemeContext.tsx`**
   - Persists visual presentation preferences into `localStorage`.
   - Dispatches changes to `.dark` class appending it into the global HTML element.
