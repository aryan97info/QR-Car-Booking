const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("node:crypto");

initializeApp();
const db = getFirestore();
const razorpayKeyId = defineSecret("RAZORPAY_KEY_ID");
const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
const razorpayWebhookSecret = defineSecret("RAZORPAY_WEBHOOK_SECRET");

function assertAdmin(request) {
  if (!request.auth || request.auth.token.email !== "aryan97.info@gmail.com" || request.auth.token.email_verified !== true) {
    throw new HttpsError("permission-denied", "केवल अधिकृत Admin यह काम कर सकता है।");
  }
}

exports.createBookingPaymentLink = onCall(
  { region: "asia-south1", secrets: [razorpayKeyId, razorpayKeySecret] },
  async (request) => {
    assertAdmin(request);
    const bookingId = String(request.data?.bookingId || "");
    if (!bookingId || bookingId.length > 100) throw new HttpsError("invalid-argument", "Booking ID सही नहीं है।");

    const ref = db.collection("bookings").doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "बुकिंग नहीं मिली।");
    const booking = snap.data();
    if (booking.status !== "नई") throw new HttpsError("failed-precondition", "यह बुकिंग नई स्थिति में नहीं है।");
    if (!booking.phone || !booking.name) throw new HttpsError("failed-precondition", "ग्राहक का नाम या मोबाइल नंबर उपलब्ध नहीं है।");

    const acceptedAt = new Date();
    const expiresAt = new Date(acceptedAt.getTime() + 4 * 60 * 60 * 1000);
    const phone = String(booking.phone).replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) throw new HttpsError("failed-precondition", "ग्राहक का मोबाइल नंबर सही नहीं है।");

    const response = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(razorpayKeyId.value() + ":" + razorpayKeySecret.value()).toString("base64"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: 50000,
        currency: "INR",
        accept_partial: false,
        description: "QR Car Booking - ₹500 booking security amount",
        reference_id: bookingId.slice(0, 40),
        expire_by: Math.floor(expiresAt.getTime() / 1000),
        customer: { name: String(booking.name).slice(0, 100), contact: phone },
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { bookingId, purpose: "booking_security_amount" }
      })
    });

    const link = await response.json();
    if (!response.ok || !link.short_url || !link.id) {
      console.error("Razorpay payment link error", link);
      throw new HttpsError("internal", "Razorpay पेमेंट लिंक नहीं बन पाया। Dashboard और API keys जाँचें।");
    }

    await ref.update({
      status: "पेमेंट बाकी",
      acceptedAt: FieldValue.serverTimestamp(),
      paymentLinkId: link.id,
      paymentLinkUrl: link.short_url,
      paymentAmount: 500,
      paymentExpiresAt: new Date(expiresAt),
      paymentStatus: "pending"
    });

    return { shortUrl: link.short_url, expiresAt: expiresAt.toISOString() };
  }
);

exports.razorpayWebhook = onRequest(
  { region: "asia-south1", secrets: [razorpayWebhookSecret] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    const signature = req.get("x-razorpay-signature") || "";
    const expected = crypto.createHmac("sha256", razorpayWebhookSecret.value()).update(req.rawBody).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).send("Invalid signature");

    const event = req.body?.event;
    const entity = req.body?.payload?.payment_link?.entity;
    if (!entity?.id) return res.status(200).send("Ignored");
    const matches = await db.collection("bookings").where("paymentLinkId", "==", entity.id).limit(1).get();
    if (matches.empty) return res.status(200).send("Booking not found");

    const bookingRef = matches.docs[0].ref;
    const currentBooking = matches.docs[0].data();
    if (event === "payment_link.paid") {
      if (currentBooking.paymentStatus === "refunded") return res.status(200).send("Already refunded");
      const payment = req.body?.payload?.payment?.entity;
      const linkedPayment = Array.isArray(entity.payments) ? entity.payments.find(p => p.status === "captured" || p.status === "paid") || entity.payments[0] : null;
      await bookingRef.update({
        status: "कन्फर्म",
        paymentStatus: "paid",
        paymentId: payment?.id || linkedPayment?.payment_id || linkedPayment?.id || currentBooking.paymentId || null,
        paidAt: FieldValue.serverTimestamp()
      });
    } else if ((event === "payment_link.expired" || event === "payment_link.cancelled") && currentBooking.paymentStatus === "pending" && currentBooking.cancelledBy !== "owner") {
      await bookingRef.update({
        status: "समय पर भुगतान नहीं - रद्द",
        paymentStatus: "expired",
        expiredAt: FieldValue.serverTimestamp()
      });
    }
    return res.status(200).send("OK");
  }
);

exports.cancelBookingByOwner = onCall(
  { region: "asia-south1", secrets: [razorpayKeyId, razorpayKeySecret] },
  async (request) => {
    assertAdmin(request);
    const bookingId = String(request.data?.bookingId || "");
    if (!bookingId || bookingId.length > 100) throw new HttpsError("invalid-argument", "Booking ID सही नहीं है।");
    const ref = db.collection("bookings").doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "बुकिंग नहीं मिली।");
    const booking = snap.data();
    if (booking.paymentStatus === "refunded") return { status: "refunded" };
    if (["मालिक ने रद्द", "मालिक ने रद्द - Refund"].includes(booking.status)) {
      throw new HttpsError("failed-precondition", "यह बुकिंग पहले ही रद्द हो चुकी है।");
    }

    const authHeader = "Basic " + Buffer.from(razorpayKeyId.value() + ":" + razorpayKeySecret.value()).toString("base64");
    if (booking.paymentStatus === "paid") {
      let paymentId = booking.paymentId;
      if (!paymentId && booking.paymentLinkId) {
        const linkResponse = await fetch("https://api.razorpay.com/v1/payment_links/" + encodeURIComponent(booking.paymentLinkId), {
          headers: { "Authorization": authHeader }
        });
        const linkDetails = await linkResponse.json();
        const linkedPayment = Array.isArray(linkDetails.payments) ? linkDetails.payments.find(p => p.status === "captured" || p.status === "paid") || linkDetails.payments[0] : null;
        paymentId = linkedPayment?.payment_id || linkedPayment?.id || null;
      }
      if (!paymentId) throw new HttpsError("failed-precondition", "पेमेंट ID उपलब्ध नहीं है। Razorpay Dashboard से जाँच आवश्यक है।");
      const refundResponse = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(paymentId) + "/refund", {
        method: "POST",
        headers: { "Authorization": authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50000, notes: { bookingId, reason: "Owner cancelled booking; full security amount refund" } })
      });
      const refund = await refundResponse.json();
      if (!refundResponse.ok || !refund.id) {
        console.error("Razorpay refund error", refund);
        throw new HttpsError("internal", "Razorpay से Refund नहीं हो पाया। Dashboard में पेमेंट जाँचें।");
      }
      await ref.update({
        status: "मालिक ने रद्द - Refund",
        paymentStatus: "refunded",
        refundId: refund.id,
        refundedAt: FieldValue.serverTimestamp(),
        cancelledBy: "owner"
      });
      return { status: "refunded", refundId: refund.id };
    }

    if (booking.paymentLinkId) {
      const cancelResponse = await fetch("https://api.razorpay.com/v1/payment_links/" + encodeURIComponent(booking.paymentLinkId) + "/cancel", {
        method: "POST",
        headers: { "Authorization": authHeader, "Content-Type": "application/json" }
      });
      if (!cancelResponse.ok) {
        const error = await cancelResponse.json().catch(() => ({}));
        console.error("Razorpay payment link cancellation error", error);
        throw new HttpsError("internal", "पेमेंट लिंक रद्द नहीं हो पाया। पहले Razorpay Dashboard में जाँचें।");
      }
    }
    await ref.update({
      status: "मालिक ने रद्द",
      paymentStatus: "not_paid",
      cancelledBy: "owner",
      cancelledAt: FieldValue.serverTimestamp()
    });
    return { status: "cancelled" };
  }
);
