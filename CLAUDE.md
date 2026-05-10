# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CampuSphere is an Express.js web application with MVC architecture that provides a virtual campus map tour for Camarines Sur Polytechnic Colleges (CSPC). It uses EJS templating, sessions for authentication, and includes role-based access control (student-cspc, instructor, admin, guest).

## Common Commands

```bash
npm start        # Start production server on port 3000
npm run dev     # Start with --watch flag for development
```

No test framework is configured.

## Architecture

The app follows MVC pattern:

- **server.js** — Main entry point, configures Express, middleware, session, and routes
- **routes/** — Route modules (index, auth, dashboard, buildings, events, map, admin)
- **controllers/** — Request handlers
- **models/data.js** — Static data module (buildings, news, roles, sidebar navigation)
- **middleware/** — logger.js, errorHandler.js (404/500)
- **views/** — EJS templates organized by page/admin/partials
- **public/** — Static assets (CSS, client-side JS, images)

Session middleware attaches `req.session.user` to `res.locals.user` for all views.

## Authentication

Uses express-session with bcrypt for password hashing. User roles are: `student-cspc`, `instructor`, `admin`, `guest`. Each role has different sidebar navigation defined in `models/data.js`.

## Environment

Environment variables in `.env` include SESSION_SECRET and database credentials for mysql2.

## Key Patterns

- Routes follow `/controllerName/methodName` convention in controllers/
- Error handling middleware catches 404 and 500 errors
- Admin routes are prefixed with `/admin`
- Client-side JS in public/js/ handles dynamic interactions