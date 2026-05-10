# Goal Description

Phase 3 focuses on implementing robust user-facing features that elevate the application from a read-only platform to an interactive experience. This includes expanding user profile management (allowing users to change their profile pictures and passwords) and introducing interactive capabilities such as saving favorite locations and RSVPing to campus events.

## User Review Required
> [!IMPORTANT]
> Please review the proposed database schema additions and the plan for profile picture handling. Let me know if you approve this plan to begin execution.

## Open Questions
> [!WARNING]
> **Profile Picture Handling**: Since the project does not currently use a file upload library like `multer`, the simplest approach is to allow users to provide an Image URL for their profile picture. 
> *Do you want to proceed with the Image URL approach, or would you prefer I set up `multer` to handle actual image file uploads to the server?*

## Proposed Changes

---

### Database Schema Updates

We need to add new columns and tables to support the interactive features.

#### [MODIFY] `database/schema.sql`
- **users table**: Add a `profile_image_url VARCHAR(255)` column to store the user's avatar.
- **New table**: `user_favorites`
  - `id INT AUTO_INCREMENT PRIMARY KEY`
  - `user_id INT` (Foreign Key referencing `users(id)`)
  - `building_id INT` (Foreign Key referencing `buildings(id)`)
  - `created_at TIMESTAMP`
- **New table**: `event_rsvps`
  - `id INT AUTO_INCREMENT PRIMARY KEY`
  - `user_id INT` (Foreign Key referencing `users(id)`)
  - `event_id INT` (Foreign Key referencing `events(id)`)
  - `status ENUM('going', 'maybe', 'not_going')`
  - `created_at TIMESTAMP`

---

### Backend API: Profile Management

Expand the existing profile controller to handle security updates and avatar changes.

#### [MODIFY] `controllers/profileController.js`
- **Update Profile Logic**: Modify `exports.updateProfile` to accept and save `profileImage` (URL) to the new `profile_image_url` column in the `users` table. Update the session accordingly.
- **New Password Update Logic**: Add an `exports.updatePassword` function.
  - Verify the user's current password using `bcrypt.compare`.
  - Hash the new password using `bcrypt.hash`.
  - Update the `users` table.

#### [MODIFY] `server.js` (or a dedicated route file)
- Register `POST /api/update-password` mapping to `profileController.updatePassword`.

---

### Backend API: Interactive Features

Create endpoints to manage favorites and RSVPs.

#### [NEW] `controllers/interactionController.js`
- **Favorites**:
  - `exports.toggleFavorite`: Add or remove a building from `user_favorites`.
  - `exports.getFavorites`: Return an array of `building_id`s favorited by the logged-in user.
- **RSVPs**:
  - `exports.updateRsvp`: Insert or update a user's status for a specific event in `event_rsvps`.
  - `exports.getUserRsvps`: Return all RSVPs for the logged-in user.

#### [MODIFY] `server.js` (or dedicated routes)
- Register the new interaction API routes:
  - `POST /api/favorites/toggle`
  - `GET /api/favorites`
  - `POST /api/events/:id/rsvp`
  - `GET /api/events/rsvps`

---

### Frontend UI & Client-Side Logic

Integrate the new capabilities into the dashboard UI.

#### [MODIFY] `views/dashboard.ejs`
- **Profile Tab**: 
  - Add an input field for "Profile Picture URL".
  - Add a dedicated "Change Password" section (Current Password, New Password, Confirm Password).
- **Buildings Tab**:
  - Add a "Favorite" button (heart icon) to each building card.
- **Events Tab**:
  - Add "RSVP" dropdowns/buttons (Going, Maybe, Not Going) to event cards.

#### [MODIFY] `public/js/profile-script.js`
- **Password Form Submission**: Add an event listener and fetch request for the Change Password form.
- **Interactive Handlers**:
  - Add a function to handle clicking the Favorite button (toggle API call, update heart icon color dynamically).
  - Add a function to handle RSVP selections.
  - Create an initialization function to fetch the user's current favorites and RSVPs on dashboard load to set the initial UI state (e.g., highlighting already favorited buildings).

## Verification Plan

### Automated Tests
- N/A - The project currently lacks an automated test suite.

### Manual Verification
- **Profile Updates**: Log in, update the profile picture URL, and verify the avatar updates across the dashboard and sidebar.
- **Password Change**: Attempt to change the password with correct and incorrect current passwords, then log out and try logging back in with the new password.
- **Favorites**: Navigate buildings, toggle favorites, refresh the page, and ensure favorites persist.
- **RSVPs**: Select an RSVP status for an event, ensure it reflects in the UI, and verify it persists upon refresh.
