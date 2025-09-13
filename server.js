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

// 🔒 Middleware: Verify Firebase ID token
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded; // contains uid, email, etc.
    next();
  } catch (err) {
    console.error("❌ Firebase Auth verification failed:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ✅ Express setup
const app = express();
app.use(cors({
  origin: ["https://retrofifty.com"], // replace with your frontend URL
}));
// 🔹 Raw parser only for webhook
app.use("/webhook", express.raw({ type: "application/json" }));

// 🔹 JSON parser for all other routes
app.use(express.json());
// ✅ Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// 🔒 Secure only order routes (not webhook, not health check)
app.use("/create-order", verifyFirebaseToken);
app.use("/verify-payment", verifyFirebaseToken);



// 🟢 Create Order
app.post("/create-order", async (req, res) => {
  console.log("⚡ [CREATE ORDER] Incoming request:", req.body);

  try {
     const { amount, currency = "INR", receipt, items } = req.body;
const userId = req.user.uid; // 🔒 trusted from token

    // ✅ Validate required fields
    if (!amount || !userId || !items) {
      console.warn("❌ Missing required fields:", req.body);
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Create Razorpay order
    const options = {
      amount: amount * 100, // convert to paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    };
    console.log("📤 Creating Razorpay order with options:", options);

    const order = await razorpay.orders.create(options);
    console.log("✅ Razorpay Order created successfully:", order);

    // ✅ Generate custom numeric orderId
    const customOrderId = Date.now().toString(); // e.g., "1757744203866"
    console.log("🆔 Generated customOrderId:", customOrderId);

    // ✅ Save order in Firestore with numeric ID
    await db.collection("orders").doc(customOrderId).set({
      orderId: customOrderId,         // 🔹 Customer-facing numeric ID
      razorpay_order_id: order.id,    // 🔹 Mapping to Razorpay order
      receipt: options.receipt,
      userId,
      items,
      amount,
      currency,
      status: "pending_payment",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`📝 Firestore order saved with docId: ${customOrderId}, linked Razorpay ID: ${order.id}`);

    // ✅ Return both IDs to frontend
    res.json({
      ...order,
      customOrderId, // this will be used in your app for tracking
    });

  } catch (err) {
    console.error("❌ Error in /create-order:", err);
    res.status(500).json({ error: "Failed to create order", details: err.message });
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

    
// ✅ Find Firestore order by Razorpay order ID
const snap = await db.collection("orders")
  .where("razorpay_order_id", "==", razorpay_order_id)
  .limit(1)
  .get();

if (snap.empty) {
  console.warn("❌ Firestore order not found:", razorpay_order_id);
  return res.status(404).json({ success: false, message: "Order not found" });
}

const orderRef = snap.docs[0].ref;
const orderData = snap.docs[0].data();
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
// 🟢 Webhook Endpoint
app.post("/webhook", async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];
  
  const bodyString = req.body.toString("utf8");
  const bodyJson = JSON.parse(bodyString);

  // Verify signature
  const expectedSignature = crypto.createHmac("sha256", webhookSecret)
                                  .update(bodyString)
                                  .digest("hex");

  if (signature !== expectedSignature) {
    return res.status(400).send("Invalid signature");
  }

  const event = bodyJson.event;
  const payment = bodyJson.payload.payment.entity;
  const razorpayOrderId = payment.order_id;

  console.log(`📡 Webhook Event: ${event}, RazorpayOrderID: ${razorpayOrderId}, PaymentID: ${payment.id}`);

  try {
    // 🔎 Find Firestore order by razorpay_order_id
    const snap = await db.collection("orders")
      .where("razorpay_order_id", "==", razorpayOrderId)
      .limit(1)
      .get();

    if (snap.empty) {
      console.error("❌ No Firestore order found for RazorpayOrderID:", razorpayOrderId);
      return res.status(404).send({ error: "Order not found" });
    }

    const docRef = snap.docs[0].ref;
    const orderId = snap.docs[0].id; // custom numeric orderId
    console.log(`📝 Found Firestore order: ${orderId} (maps to Razorpay: ${razorpayOrderId})`);

    if (event === "payment.captured") {
      await docRef.update({
        status: "paid",
        paymentId: payment.id,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ Webhook: Order ${orderId} marked as PAID`);
    } else if (event === "payment.failed") {
      await docRef.update({
        status: "payment_failed",
        failureReason: payment.error_reason || "Unknown",
      });
      console.log(`❌ Webhook: Order ${orderId} marked as FAILED (${payment.error_reason})`);
    } else {
      console.log(`ℹ️ Webhook event ignored: ${event}`);
    }

    return res.status(200).send({ status: "ok" });
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    return res.status(500).send({ error: err.message });
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