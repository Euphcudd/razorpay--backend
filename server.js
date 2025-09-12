// server.js
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");
const admin = require("firebase-admin");
const fs = require("fs");

dotenv.config();

// ✅ Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json"); // replace with your key path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ✅ Express setup
const app = express();
app.use(cors({
  origin: ["https://retrofifty.com"], // replace with your frontend URL
}));
app.use(express.json());

// ✅ Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 🟢 Create Order
app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt, userId, items } = req.body;

    if (!amount || !userId || !items) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const options = {
      amount: amount * 100, // convert to paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    // Save initial order in Firestore
    await db.collection("orders").doc(order.id).set({
      orderId: order.id,
      receipt: options.receipt,
      userId,
      items,
      amount,
      currency,
      status: "pending_payment",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json(order);
  } catch (err) {
    console.error("❌ Error creating Razorpay order:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// 🟢 Verify Payment (frontend callback)
app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = hmac.digest("hex");

    if (digest === razorpay_signature) {
      // Update Firestore order status
      const orderRef = db.collection("orders").doc(razorpay_order_id);
      await orderRef.update({
        status: "paid",
        paymentId: razorpay_payment_id,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, message: "Payment verified and order updated" });
    } else {
      res.status(400).json({ success: false, message: "Payment verification failed" });
    }
  } catch (err) {
    console.error("❌ Error verifying payment:", err);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// 🟢 Webhook Endpoint (source of truth)
app.post("/webhook", async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];
  const body = JSON.stringify(req.body);

  const expectedSignature = crypto.createHmac("sha256", webhookSecret)
                                  .update(body)
                                  .digest("hex");

  if (signature !== expectedSignature) {
    console.warn("⚠️ Invalid webhook signature");
    return res.status(400).send("Invalid signature");
  }

  const event = req.body.event;
  const payment = req.body.payload.payment.entity;
  const orderId = payment.order_id;

  try {
    const orderRef = db.collection("orders").doc(orderId);

    if (event === "payment.captured") {
      await orderRef.update({
        status: "paid",
        paymentId: payment.id,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (event === "payment.failed") {
      await orderRef.update({
        status: "payment_failed",
        failureReason: payment.error_reason,
      });
    }

    res.status(200).send({ status: "ok" });
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    res.status(500).send({ error: err.message });
  }
});

// 🟢 Health Check
app.get("/", (req, res) => {
  res.send("✅ Razorpay backend running!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
