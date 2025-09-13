// // server.js
// const express = require("express");
// const Razorpay = require("razorpay");
// const cors = require("cors");
// const dotenv = require("dotenv");
// const crypto = require("crypto");
// const admin = require("firebase-admin");

// dotenv.config();

// // ✅ Firebase Admin SDK using environment variables
// admin.initializeApp({
//   credential: admin.credential.cert({
//     projectId: process.env.FIREBASE_PROJECT_ID,
//     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//     privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//   }),
// });

// const db = admin.firestore();

// // ✅ Express setup
// const app = express();
// app.use(cors({
//   origin: ["https://retrofifty.com"], // replace with your frontend URL
// }));
// app.use(express.json());

// // ✅ Razorpay instance
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// // 🟢 Create Order
// app.post("/create-order", async (req, res) => {
//   try {
//     const { amount, currency = "INR", receipt, userId, items } = req.body;

//     if (!amount || !userId || !items) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     const options = {
//       amount: amount * 100, // convert to paise
//       currency,
//       receipt: receipt || `rcpt_${Date.now()}`,
//     };

//     const order = await razorpay.orders.create(options);

//     // Save initial order in Firestore
//    await db.collection("orders").doc(order.id).set({
//   orderId: order.id,
//    razorpay_order_id: order.id, 
//   receipt: options.receipt,
//   userId,
//   items,
//   amount,
//   currency,
//   status: "pending_payment",
//   createdAt: admin.firestore.FieldValue.serverTimestamp(),
// });

//     res.json(order);
//   } catch (err) {
//     console.error("❌ Error creating Razorpay order:", err);
//     res.status(500).json({ error: "Failed to create order" });
//   }
// });

// // 🟢 Verify Payment (frontend callback)
// app.post("/verify-payment", async (req, res) => {
//   try {
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

//     // Verify signature
//     const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
//     hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
//     const digest = hmac.digest("hex");

//     if (digest !== razorpay_signature) {
//       return res.status(400).json({ success: false, message: "Payment verification failed" });
//     }

//     // ✅ Fetch order from Firestore
//     const orderRef = db.collection("orders").doc(razorpay_order_id);
//     const orderSnap = await orderRef.get();
//     if (!orderSnap.exists) {
//       return res.status(404).json({ success: false, message: "Order not found" });
//     }

//     const orderData = orderSnap.data();

//     // ✅ Update order status
//     await orderRef.update({
//       status: "paid",
//       paymentId: razorpay_payment_id,
//       paidAt: admin.firestore.FieldValue.serverTimestamp(),
//     });

//     // ✅ Update stock for items
//     for (const item of orderData.items) {
//       const plantRef = db.collection("plants").doc(item.plantId);
//       const plantSnap = await plantRef.get();
//       if (!plantSnap.exists) continue;

//       const plantData = plantSnap.data();
//       if (item.varietyId && plantData.varieties) {
//         const updatedVarieties = plantData.varieties.map(v => {
//           if (v.id === item.varietyId) {
//             return { ...v, isAvailable: false, isReserved: false, reservedUntil: admin.firestore.FieldValue.delete() };
//           }
//           return v;
//         });
//         await plantRef.update({
//           varieties: updatedVarieties,
//           isAvailable: updatedVarieties.some(v => v.isAvailable === true),
//         });
//       } else {
//         await plantRef.update({
//           isAvailable: false,
//           isReserved: false,
//           reservedUntil: admin.firestore.FieldValue.delete(),
//         });
//       }
//     }

//     // ✅ Optional: send order notification here
//     // await sendOrderNotification(orderData);

//     res.json({ success: true, orderId: orderData.orderId, customerName: orderData.address?.name });
//   } catch (err) {
//     console.error("❌ Error verifying payment:", err);
//     res.status(500).json({ success: false, message: "Failed to verify payment" });
//   }
// });

// // 🟢 Webhook Endpoint (source of truth)
// app.post("/webhook", async (req, res) => {
//   const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
//   const signature = req.headers["x-razorpay-signature"];
//   const body = JSON.stringify(req.body);

//   const expectedSignature = crypto.createHmac("sha256", webhookSecret)
//                                   .update(body)
//                                   .digest("hex");

//   if (signature !== expectedSignature) {
//     console.warn("⚠️ Invalid webhook signature");
//     return res.status(400).send("Invalid signature");
//   }

//   const event = req.body.event;
//   const payment = req.body.payload.payment.entity;
//   const orderId = payment.order_id;

//   try {
//     const orderRef = db.collection("orders").doc(orderId);

//     if (event === "payment.captured") {
//       await orderRef.update({
//         status: "paid",
//         paymentId: payment.id,
//         paidAt: admin.firestore.FieldValue.serverTimestamp(),
//       });
//     } else if (event === "payment.failed") {
//       await orderRef.update({
//         status: "payment_failed",
//         failureReason: payment.error_reason,
//       });
//     }

//     res.status(200).send({ status: "ok" });
//   } catch (err) {
//     console.error("❌ Webhook processing error:", err);
//     res.status(500).send({ error: err.message });
//   }
// });

// // 🟢 Health Check
// app.get("/", (req, res) => {
//   res.send("✅ Razorpay backend running!");
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });



// server.js
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");
const admin = require("firebase-admin");

dotenv.config();

// ✅ Firebase Admin SDK using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
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
  console.log("⚡ [CREATE ORDER] Request body:", req.body);
  try {
    const { amount, currency = "INR", receipt, userId, items } = req.body;

    if (!amount || !userId || !items) {
      console.warn("❌ Missing fields in create-order:", req.body);
      return res.status(400).json({ error: "Missing required fields" });
    }

    const options = {
      amount: amount * 100, // convert to paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    };

    console.log("📤 Creating Razorpay order with options:", options);

    const order = await razorpay.orders.create(options);
    console.log("✅ Razorpay Order created:", order);

    // Save initial order in Firestore
    await db.collection("orders").doc(order.id).set({
      orderId: order.id,
      razorpay_order_id: order.id,
      receipt: options.receipt,
      userId,
      items,
      amount,
      currency,
      status: "pending_payment",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`📝 Firestore order saved with ID: ${order.id}`);

    res.json(order);
  } catch (err) {
    console.error("❌ Error creating Razorpay order:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// 🟢 Verify Payment (frontend callback)
app.post("/verify-payment", async (req, res) => {
  console.log("⚡ [VERIFY PAYMENT] Incoming body:", req.body);
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = hmac.digest("hex");

    console.log("🔐 Expected digest:", digest);
    console.log("🔐 Received signature:", razorpay_signature);

    if (digest !== razorpay_signature) {
      console.warn("❌ Signature mismatch, payment verification failed");
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    console.log("✅ Signature verified successfully");

    // ✅ Fetch order from Firestore
    const orderRef = db.collection("orders").doc(razorpay_order_id);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      console.warn("❌ Firestore order not found:", razorpay_order_id);
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderData = orderSnap.data();
    console.log("📥 Firestore order data:", orderData);

    // ✅ Update order status
    await orderRef.update({
      status: "paid",
      paymentId: razorpay_payment_id,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Firestore order ${razorpay_order_id} updated to "paid"`);

    // ✅ Update stock for items
    for (const item of orderData.items) {
      console.log("📦 Updating stock for item:", item);
      const plantRef = db.collection("plants").doc(item.plantId);
      const plantSnap = await plantRef.get();
      if (!plantSnap.exists) {
        console.warn("⚠️ Plant not found:", item.plantId);
        continue;
      }

      const plantData = plantSnap.data();
      if (item.varietyId && plantData.varieties) {
        const updatedVarieties = plantData.varieties.map(v => {
          if (v.id === item.varietyId) {
            console.log(`🔄 Marking variety ${item.varietyId} as unavailable`);
            return { ...v, isAvailable: false, isReserved: false, reservedUntil: admin.firestore.FieldValue.delete() };
          }
          return v;
        });
        await plantRef.update({
          varieties: updatedVarieties,
          isAvailable: updatedVarieties.some(v => v.isAvailable === true),
        });
        console.log("✅ Plant varieties updated in Firestore");
      } else {
        await plantRef.update({
          isAvailable: false,
          isReserved: false,
          reservedUntil: admin.firestore.FieldValue.delete(),
        });
        console.log("✅ Plant updated (single variant)");
      }
    }

    res.json({ success: true, orderId: orderData.orderId, customerName: orderData.address?.name });
  } catch (err) {
    console.error("❌ Error verifying payment:", err);
    res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
});

// 🟢 Webhook Endpoint (source of truth)
app.post("/webhook", async (req, res) => {
  console.log("⚡ [WEBHOOK] Event received:", req.body);

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];
  const body = JSON.stringify(req.body);

  const expectedSignature = crypto.createHmac("sha256", webhookSecret)
                                  .update(body)
                                  .digest("hex");

  console.log("🔐 Expected webhook signature:", expectedSignature);
  console.log("🔐 Received webhook signature:", signature);

  if (signature !== expectedSignature) {
    console.warn("⚠️ Invalid webhook signature");
    return res.status(400).send("Invalid signature");
  }

  const event = req.body.event;
  const payment = req.body.payload.payment.entity;
  const orderId = payment.order_id;

  console.log(`📡 Webhook Event: ${event}, OrderID: ${orderId}, PaymentID: ${payment.id}`);

  try {
    const orderRef = db.collection("orders").doc(orderId);

    if (event === "payment.captured") {
      await orderRef.update({
        status: "paid",
        paymentId: payment.id,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ Webhook: Order ${orderId} marked as PAID`);
    } else if (event === "payment.failed") {
      await orderRef.update({
        status: "payment_failed",
        failureReason: payment.error_reason,
      });
      console.log(`❌ Webhook: Order ${orderId} marked as FAILED (${payment.error_reason})`);
    } else {
      console.log(`ℹ️ Webhook event ignored: ${event}`);
    }

    res.status(200).send({ status: "ok" });
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    res.status(500).send({ error: err.message });
  }
});

// 🟢 Health Check
app.get("/", (req, res) => {
  console.log("✅ Health check called");
  res.send("✅ Razorpay backend running!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});