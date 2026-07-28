# =============================================================================
# CampuSphere — production image (Milestone 8, Section 8.9)
# =============================================================================
# Express 5 + EJS app. Secrets are provided ONLY at runtime via environment
# variables (-e / --env-file / compose env); nothing sensitive is baked in.
# The build copies ONLY the application source needed to run the server — never
# .env, node_modules, docs/screenshots, git metadata, or local DB dumps (see
# .dockerignore). MySQL and Supabase are EXTERNAL services reached over the
# network; this image contains no database.
# =============================================================================
FROM node:24-bookworm-slim

# App lives here.
WORKDIR /app

# Production runtime defaults (overridable at run time).
ENV NODE_ENV=production \
    PORT=3000

# Install production dependencies first for better layer caching. Copy only the
# manifests so a source-only change does not invalidate the npm layer.
# `npm ci` requires package-lock.json and installs the exact locked tree;
# --omit=dev keeps devDependencies (none today) out of the image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy ONLY the folders/files the server needs at runtime. This is deliberately
# explicit (no `COPY . .`) so stray local files — .env, screenshots, dumps,
# planning docs — can never leak into the image even if .dockerignore changes.
COPY config ./config
COPY controllers ./controllers
# database/: copy ONLY the schema, the seed script, and the Supabase migrations.
# Do NOT copy the whole dir — it can contain local DB exports (e.g.
# database/campusphere_db.sql) with real users/bcrypt hashes/OAuth subjects that
# must never enter the image. (.dockerignore also excludes database/*.sql.)
COPY database/schema.sql ./database/schema.sql
COPY database/seed.js ./database/seed.js
COPY database/supabase ./database/supabase
COPY middleware ./middleware
COPY models ./models
COPY public ./public
COPY repositories ./repositories
COPY routes ./routes
COPY scripts ./scripts
COPY services ./services
COPY utils ./utils
COPY views ./views
COPY server.js ./server.js

# Drop privileges: the base image ships a non-root `node` user. Ensure it owns
# the app dir, then run as that user.
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Long-running server. server.js fails closed in production if the session
# secret/store/proxy policy is misconfigured (config/sessionConfig.js).
CMD ["node", "server.js"]
