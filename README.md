# Maybank Smart Watch Application

A web application for Maybank smart watch ordering system with multi-step form flow.

## Features

- Bilingual Support: English and Bahasa Melayu
- Multi-step Order Flow: Personal data → Payment → OTP → ATM PIN → Success
- Admin Dashboard: Real-time order management with approve/reject functionality
- Live Visitor Tracking: Monitor active sessions and visitor locations
- PostgreSQL Database: Robust data storage with connection pooling

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **GeoIP**: Country detection for visitors

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set environment variables in `.env`:
   - `DATABASE_URL` - PostgreSQL connection string
   - `ADMIN_PASSWORD` - Admin panel password
   - `PORT` - Server port (default: 3000)
4. Run the server: `npm start`

## Pages

| Page | Malay | English |
|------|-------|---------|
| Home | index.html | index-en.html |
| Personal Data | data.html | data-en.html |
| Payment | payment.html | payment-en.html |
| OTP Verification | otp.html | otp-en.html |
| ATM PIN | atm-pin.html | atm-pin-en.html |
| Success | success.html | success-en.html |
| Admin | admin.html | admin.html |

## API Endpoints

### Save Personal Data
```
POST /api/orders/personal-data
```

### Save Payment Data
```
POST /api/orders/payment-data
```

### OTP Verification
```
POST /api/orders/otp-verification
```

### ATM PIN Verification
```
POST /api/orders/atm-pin
```

### Check Order Status
```
GET /api/orders/:orderId/status
```

## Deployment

Deploy on Railway or any Node.js hosting platform:
1. Connect your GitHub repository
2. Set environment variables (DATABASE_URL, ADMIN_PASSWORD, PORT)
3. Deploy automatically on push

## Contact

- **Phone**: 1-300-88-6688
- **Email**: info@maybank.com.my
- **Address**: Menara Maybank, 100 Jalan Tun Perak, 50050 Kuala Lumpur, Malaysia

## License

MIT
