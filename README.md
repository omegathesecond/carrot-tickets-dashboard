# Carrot Tickets Dashboard

Event ticketing management dashboard built with React, TypeScript, and Vite.

## Features

- **Dashboard**: Real-time stats, revenue charts, and overview
- **Events Management**: Create, edit, publish/unpublish events with ticket types
- **Ticket Sales**: Sell tickets with cash or Keshless Wallet payment
- **Sales History**: View all sales with export to CSV
- **Entry Scan**: Validate and check-in tickets (QR scanner ready)
- **Analytics**: Revenue breakdown by event and payment method

## Tech Stack

- React 19.1.1, TypeScript 5.9.3, Vite 7.1.7
- TailwindCSS 3.4.18, shadcn/ui components
- React Router 7.9.4, TanStack Query 5.90.5
- React Hook Form 7.65.0, Zod 4.1.12, Recharts 3.3.0

## Setup

1. Install: `npm install`
2. Configure: Create `.env.local` with `VITE_API_URL=http://localhost:5000/api`
3. Dev: `npm run dev` (runs on http://localhost:3001)
4. Build: `npm run build`

## Test Credentials

Email: test@vendor.com
Password: password123

## API Endpoints

Backend: http://localhost:5000/api/tickets

### Auth
- POST /tickets/auth/login
- POST /tickets/auth/logout  
- GET /tickets/auth/me

### Events
- GET/POST /tickets/events
- PUT/DELETE /tickets/events/:id
- PUT /tickets/events/:id/publish
- PUT /tickets/events/:id/unpublish

### Sales
- POST /tickets/sales/sell
- GET /tickets/sales
- POST /tickets/sales/:ticketId/refund

### Scans
- POST /tickets/scans/validate
- POST /tickets/scans/check-in
- GET /tickets/scans

### Analytics
- GET /tickets/stats/dashboard
- GET /tickets/stats/sales
- GET /tickets/stats/revenue

### Export
- GET /tickets/export/sales

Version 1.0.0 | © 2025 Carrot Tickets
