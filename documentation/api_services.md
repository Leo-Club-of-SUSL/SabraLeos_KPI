# API & Services Map

The application interacts with its backend (Supabase) via a dedicated service layer located in `src/services/`. This ensures that React components do not contain direct database queries, promoting code reuse, testability, and separation of concerns.

## 1. `member-service.ts`
Manages all operations related to the Leo Club members registry.
- `getMembers()`: Fetches the list of members, supports pagination and search filters.
- `getMemberByRegNo(regNo)`: Retrieves a specific member's details.
- `createMember(memberData)`: Inserts a new member into the database.
- `updateMember(regNo, updateData)`: Updates an existing member's properties.
- `deleteMember(regNo)`: Deletes a member.
- `uploadMemberPhoto(file)`: Uploads an image to Supabase Storage and returns the public URL.

## 2. `contribution-service.ts`
Handles operations related to member service points and project contributions.
- `getContributionsByMember(regNo)`: Fetches the history of contributions for a given user.
- `addContribution(contributionData)`: Logs a new contribution. Triggers a database-level point recalculation function.
- `updateContribution(id, updateData)`: Modifies an existing contribution record.
- `deleteContribution(id)`: Removes a contribution and correctly substracts the associated points from the member's total.

## 3. `user-service.ts`
Manages internal application users, roles, and administrative tasks.
- `getUsers()`: Retrieves a list of all users from `app_users` (Super Admin only).
- `createUser(userData)`: Generates a new Supabase auth user and immediately creates a linked `app_users` record.
- `updateUserRole(userId, newRole)`: Changes the permission boundaries for a specific user.
- `linkUserToMember(userId, regNo)`: Attaches an internal User account to a Public Member profile.

## 4. `bulk-import-service.ts`
Provides advanced data ingestion utilities to mitigate manual data entry friction.
- `importMembersFromCSV(file)`: Parses a provided `.csv` or `.xlsx` file utilizing the `xlsx` library and executes bulk inserts into the `members` database table. Validates registration numbers to prevent duplicates.
- `importContributionsFromCSV(file)`: Parses contribution bulk data and assigns them to respective members.

## Architectural Notes
- **Direct Database Access:** Because Supabase acts as a Backend-as-a-Service, these services utilize the `@supabase/supabase-js` SDK to issue queries directly against PostgreSQL.
- **Error Handling:** Service functions catch Supabase-specific errors and normalize them into generic Javascript Promises/Exceptions for components to gracefully capture and display to the end-user.
