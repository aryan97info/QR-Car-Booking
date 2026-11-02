# QR Car Booking

Mobile-first Hindi car booking website using Firebase Authentication, Firestore and WhatsApp.

## Current features
- Customer booking form; booking requests are saved in Firestore.
- Admin Google login restricted to `aryan97.info@gmail.com`.
- Admin can manage cars, diesel rates and the owner's WhatsApp number.
- Admin can upload a PhonePe QR image (PNG/JPG/WEBP, up to 700 KB). The image is stored in the public Firestore settings document.
- When Admin accepts a booking, the booking is marked as awaiting ₹500 payment for four hours and WhatsApp opens with the customer-specific message and payment terms.
- Admin manually attaches the downloaded QR image in the WhatsApp chat and presses Send. WhatsApp's prefilled-message link cannot attach an image automatically.
- Admin checks the PhonePe transaction manually and uses **PhonePe पेमेंट मिल गया – Confirm करें** to confirm the booking.
- ₹500 is adjusted against the estimated fare. Customer cancellation is non-refundable; if the owner cancels after receiving payment, the owner must manually refund ₹500 through PhonePe before recording the refund in the panel.

## Four-hour payment deadline
A booking that remains unpaid after four hours is marked cancelled when the Admin Panel next refreshes/opens. This is a browser-side check, not a guaranteed background scheduler; it does not run while the site is closed. No Firebase Cloud Functions or Blaze billing plan is used.

## Setup
1. Publish `firestore.rules` to Firebase.
2. Enable Google sign-in in Firebase Authentication.
3. Host `index.html` on GitHub Pages or another static host.
4. Sign in with the authorized Admin Google account.
5. Save the business WhatsApp number and upload the PhonePe QR in Admin Panel.

## Notes
- WhatsApp is not sent automatically. Admin must attach the QR image if it is not already shared in the chat and press Send.
- QR upload is stored as a data URL in Firestore; keep it below 700 KB to stay within Firestore document-size limits.
- Verify the actual PhonePe transaction in the PhonePe app/bank account. A screenshot or customer claim alone is not payment verification.
