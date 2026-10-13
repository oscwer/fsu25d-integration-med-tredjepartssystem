# Oscar's Random Shop

A simple fullstack e-commerce application built as part of the Systemutveckling course at Medieinstitutet.

The application allows customers to browse products, add items to a shopping cart and place an order. The admin view allows products to be created and edited, and incoming orders to be reviewed.

## Live demo

https://fsu25d-systemutveckling-ecommerce-c.vercel.app

The admin view is available through the **Admin** button in the navigation. No login is required.

## Features

- Product listing
- Shopping cart with quantities and totals
- Checkout with customer name and email
- Orders stored in the database
- Admin product management
- Admin order overview
- Responsive storefront and admin interface

## Tech stack

### Frontend
- React
- Vite
- CSS

### Backend
- Node.js
- Express

### Database
- Supabase
- PostgreSQL

### Deployment
- Vercel

## Documentation

Project documentation is available in the `docs/` directory:

- `docs/sitemap.md`
- `docs/er-diagram.md`
- `docs/project-plan.md`

Database migrations are available in:

- `server/db/`

## Running locally

### Backend

```bash```
cd server
npm install
npm start

The backend runs on:
http://localhost:3000

A local server/.env file is required with the Supabase environment variables used by the backend.

### Frontend

```bash```
cd client
npm install
npm run dev

Vite will print the local frontend URL in the terminal.

During local development, Vite proxies /api requests to the backend on port 3000.
