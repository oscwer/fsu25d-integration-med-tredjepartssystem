
# Oscar's Random Shop

A fullstack e-commerce application built with React, Express and PostgreSQL as part of my Fullstack Developer studies at Medieinstitutet.

The project started as an individual assignment in system development and is currently being extended with third-party API integrations.

## Features

- Product catalog with responsive layout
- Shopping cart with quantities and totals
- Checkout and order creation
- Product management (create and edit)
- Admin overview of incoming orders
- Persistent storage using PostgreSQL

### In progress

- Currency conversion using the Frankfurter exchange rate API

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, JavaScript, Vite, CSS |
| Backend | Node.js, Express, REST API |
| Database | PostgreSQL, Supabase |
| Deployment | Vercel |
| Version control | Git, GitHub |

## Architecture

The application consists of three main parts:

1. **React frontend** – Handles the user interface, shopping cart and checkout.
2. **Express backend** – Provides REST endpoints for products, orders and external integrations.
3. **Supabase/PostgreSQL** – Stores products, orders and order items.

The frontend communicates with the backend through HTTP requests. The backend handles database operations and communicates with external APIs.

## Project structure

- `client/` – React frontend
- `server/` – Express backend and database connection
- `server/integrations/` – External API integrations
- `server/db/` – Database migrations
- `docs/` – Project documentation

## Running locally

### Backend

```bash
cd server
npm install
npm start
```

Create a `server/.env` file containing the required Supabase environment variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_server_side_secret
```

Never commit real credentials to Git.

The backend runs on `http://localhost:3000`.

### Frontend

```bash
cd client
npm install
npm run dev
```

Vite will display the local development URL.

During local development, Vite proxies `/api` requests to the Express backend.

## Documentation

- [Project plan](docs/project-plan.md)
- [Database ER diagram](docs/er-diagram.md)
- [Sitemap](docs/sitemap.md)

## Known limitations

This is an educational project, not a production-ready e-commerce platform.

- Admin functionality currently has no authentication or authorization.
- Order endpoints are not protected against unauthorized access.
- Error handling and input validation need further improvement.
- Currency conversion is still under development.

The public demo should not be used with real personal information or payment data.

## About

Built by Oscar Wersäll as part of the Fullstack Developer program at Medieinstitutet, Stockholm.
