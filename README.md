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
