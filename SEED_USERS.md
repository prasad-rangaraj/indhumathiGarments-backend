# Default Users

After running the database seed, the following users will be created:

## Admin User
- **Email:** admin@gmail.com
- **Password:** 123
- **Role:** admin
- **Access:** Full admin panel access

## Customer User
- **Email:** customer@gmail.com
- **Password:** 123
- **Role:** customer
- **Access:** Customer area access

## How to Seed

1. Make sure you've run migrations first:
   ```bash
   npm run prisma:migrate
   ```

2. Run the seed script:
   ```bash
   npm run prisma:seed
   ```

3. You should see:
   ```
   🌱 Seeding database...
   ✅ Admin user created: admin@gmail.com
   ✅ Customer user created: customer@gmail.com
   ✨ Seeding completed!
   ```

## Login Endpoint

Use the `/api/auth/login` endpoint to authenticate:

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@gmail.com",
  "password": "123"
}
```

Response:
```json
{
  "id": "uuid",
  "email": "admin@gmail.com",
  "name": "Admin User",
  "role": "admin",
  "phone": null
}
```

## Security Note

⚠️ **Important:** These are default development credentials. In production:
- Change default passwords
- Use stronger passwords
- Implement proper authentication (JWT tokens)
- Add rate limiting
- Use HTTPS



