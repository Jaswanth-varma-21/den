# Bear's Den

Full-stack Bear's Den storefront demo with an Express/PostgreSQL backend and static frontend.

## Project structure

- `backend/` — Express API, PostgreSQL schema, migrations, seed scripts and tests
- `frontend/public/` — storefront, checkout, admin and demo payment pages

## Run locally

1. Install Node.js 22+ and PostgreSQL 16+.
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` plus a strong `JWT_SECRET`.
3. From `backend/`, run `npm install`.
4. Run `npm run seed` to create the schema and seed demo data.
5. Run `npm start` and open `http://localhost:3000`.

Never commit a real `.env` file or production credentials. For deployment, configure secrets through the hosting provider and use a managed PostgreSQL database.
