# QR Car Booking

A mobile-first Hindi car-booking website starter for QR-code entry. It is responsive on phones and laptops.

## Current starter features
- Responsive landing page and booking form
- Sample car cards; selecting a car fills the form
- Date cannot be set earlier than today
- Booking details are formatted into a WhatsApp message
- The user must enter the owner's WhatsApp number and press Send in WhatsApp

## Important limitations
This is a frontend starter, not a complete production booking system.
- Bookings are not saved to a shared database.
- There is no secure admin login or multi-device admin panel yet.
- The WhatsApp message is opened for manual sending; no automatic WhatsApp notification is sent.
- Online advance payment is not enabled.
- Sample cars and prices must be replaced with real details.

## Preview locally
Open `index.html` in a browser.

## Next steps before public launch
1. Set the business WhatsApp number safely (do not expose private credentials).
2. Add a backend/database and secure admin authentication.
3. Save bookings and manage cars from the admin panel.
4. Integrate a payment provider using server-side verification/webhooks; never trust a browser-only payment status.
5. Configure automated WhatsApp notifications through an approved WhatsApp Business Platform provider.
6. Add a privacy notice and test booking flow on mobile and desktop.

## Free hosting
This static starter can be hosted on a free static-site plan, subject to that provider's current limits. Database, payment gateway and automated WhatsApp services may have separate limits or fees.


## ₹500 booking security payment (Razorpay)

The booking flow is admin-approved:
1. Customer submits a booking request; it remains **नई / Pending**.
2. Admin clicks **बुकिंग स्वीकार करें और ₹500 पेमेंट लिंक भेजें**.
3. A Razorpay Payment Link for ₹500 is created with a four-hour expiry. The customer WhatsApp message explains that ₹500 is adjusted against the final fare and includes the cancellation rules.
4. The booking becomes **कन्फर्म** only after the signed Razorpay webhook confirms payment. An expired payment link marks the booking cancelled.
5. Admin can cancel an accepted/confirmed booking. An unpaid link is cancelled; a paid booking triggers a full ₹500 refund through Razorpay.

### One-time deployment setup

Requires Firebase CLI, access to project `qr-car-booking`, and the Firebase **Blaze** billing plan for Cloud Functions. Do not put Razorpay secrets in `index.html` or GitHub.

From the repository root:

```bash
npm install -g firebase-tools
firebase login
firebase use qr-car-booking
cd functions
npm install
cd ..
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
firebase deploy --only functions
```

Use Razorpay **Live** API keys only after testing with Test Mode first. Set each secret when prompted; never commit its value.

After deployment, get the webhook endpoint with:

```bash
firebase functions:list
```

In Razorpay Dashboard → Account & Settings → Webhooks, add the deployed `razorpayWebhook` URL, enter the same webhook secret saved above, and subscribe to:
- `payment_link.paid`
- `payment_link.expired`
- `payment_link.cancelled`

The callable functions run in `asia-south1`. Deploy the Functions before using the new Admin button. GitHub Pages serves the frontend separately; allow its deployment to finish after the `index.html` commit.

### Operational notes

- The ₹500 is included in the estimated fare; the remaining amount is estimated fare minus ₹500.
- Customer cancellation is non-refundable under the displayed policy. Owner cancellation triggers a full ₹500 refund when the payment has been received.
- A booking is not confirmed merely because the WhatsApp message or payment page opened. Only a verified webhook changes it to confirmed.
- Test the complete flow in Razorpay Test Mode, including successful payment, four-hour expiry, owner cancellation before payment, and owner cancellation after payment, before switching to Live Mode.
