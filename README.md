# Indhumathi Backend API

Backend server for Indhumathi Cotton Blossom e-commerce platform.

## Tech Stack

- **Node.js** with **Express**
- **MySQL** database
- **Prisma** ORM
- **TypeScript**

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
DATABASE_URL="mysql://user:password@localhost:3306/indhumathi_db"
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
```

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

5. Start development server:
```bash
npm run dev
```

## API Endpoints

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/categories/list` - Get categories

### Orders
- `GET /api/orders` - Get orders
- `GET /api/orders/:orderId` - Get order by ID
- `POST /api/orders` - Create order
- `PATCH /api/orders/:orderId/status` - Update order status

### Reviews
- `GET /api/reviews/product/:productId` - Get product reviews
- `POST /api/reviews` - Create review

### Cart
- `GET /api/cart/:userId` - Get cart items
- `POST /api/cart` - Add to cart
- `PATCH /api/cart/:id` - Update cart item
- `DELETE /api/cart/:id` - Remove from cart

### Wishlist
- `GET /api/wishlist/:userId` - Get wishlist
- `POST /api/wishlist` - Add to wishlist
- `DELETE /api/wishlist/:userId/:productId` - Remove from wishlist

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/products` - All products
- `GET /api/admin/customers` - All customers
- `GET /api/admin/orders` - All orders
- `GET /api/admin/reviews` - All reviews
- `PATCH /api/admin/reviews/:id` - Update review approval

## Database Schema

See `prisma/schema.prisma` for the complete database schema.

## CORS

CORS is configured to allow requests from the frontend URL specified in `FRONTEND_URL` environment variable.



