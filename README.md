# 🌸 Indhumathi Cotton Blossom - Backend API

Professional High-Performance E-commerce Backend designed for **Indhumathi Garments**, specializing in pure cotton women's innerwear.

---

## 👕 Product Details
**Indhumathi Garments** provides premium, breathable, and skin-friendly cotton innerwear for women. The platform manages:
- **Slips & Camisoles**: Everyday comfort wear.
- **Panties & Bloomers**: High-quality pure cotton essentials.
- **Inner Essentials**: Specialized cotton garments designed for the Indian climate.

The backend handles multi-variant inventory (Size/Color), secure Razorpay payments, and atomic stock management.

---

## 🛠 Tech Stack

- **Framework**: [Fastify](https://www.fastify.io/) (High performance, low overhead)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (Hosted on AWS EC2)
- **ORM**: [TypeORM](https://typeorm.io/) (Data Mapper pattern)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Validation**: [Zod](https://zod.dev/) with Fastify Type Provider
- **Payments**: [Razorpay](https://razorpay.com/)
- **Auth**: JWT with Cookie-based persistence & Google OAuth

---

## 🚀 How to Run

### 1. Prerequisite: Database Tunnel
Since the database is securely hosted on an AWS EC2 instance, you MUST establish a secure SSH tunnel in a separate terminal:

```bash
# Replace with your local path to the PEM key
ssh -i ~/indhumathi-garments.pem -N -L 5433:localhost:5432 ubuntu@43.204.150.118
```
*Note: Keep this terminal open while the server is running.*

### 2. Environment Setup
Create a `.env` file in the root directory:

```env
PORT=5001
NODE_ENV=development

# Database (via Tunnel)
DATABASE_URL="postgresql://garments_user:StrongPass123@localhost:5433/indhumathi_garments"

# Security
JWT_SECRET="your_secure_jwt_secret"

# Payments
RAZORPAY_KEY_ID="your_razorpay_key"
RAZORPAY_KEY_SECRET="your_razorpay_secret"

# Frontend Integration
FRONTEND_URL="http://localhost:8080"
```

### 3. Installation
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```
The API will be available at `http://localhost:5001`.

---

## 🔗 Key API Modules

- `/api/auth`: Login, Register, Google OAuth, OTP Verification.
- `/api/products`: Catalog management with Size/Stock guards.
- `/api/cart`: Secure per-user cart management.
- `/api/payments`: Atomic Razorpay order creation & signature verification.
- `/api/admin`: Dashboard stats, inventory control, and order fulfillment.

---

## 🔒 Security Features
- **Atomic Transactions**: Prevents overselling products during high traffic.
- **HMAC Verification**: Cryptographically verifies payment signatures.
- **IDOR Protection**: Every request is scoped to the authenticated user's ID.
- **Rate Limiting**: Protected against brute-force and DoS attacks.
