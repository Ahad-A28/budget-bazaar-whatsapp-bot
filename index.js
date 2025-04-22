const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Send WhatsApp message
app.post('/order-webhook', async (req, res) => {
    const order = req.body;
    const customerName = order.customer?.first_name || "Customer";
    const productName = order.line_items?.[0]?.title || "your item";
    const phone = order.note_attributes?.find(attr => attr.name === "whatsapp")?.value || null;

    if (!phone) return res.status(400).send("No WhatsApp number provided in order.");

    const message = `Hi ${customerName}, this is Budget Bazaar. Please confirm your order for "${productName}". Reply YES to confirm or NO to cancel.`;

    try {
        await axios.post(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body: message }
        }, {
            headers: {
                Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            }
        });
        res.sendStatus(200);
    } catch (error) {
        console.error("Error sending WhatsApp message:", error.response?.data || error.message);
        res.sendStatus(500);
    }
});

// Verify webhook (for WhatsApp callback)
app.get('/whatsapp-webhook', (req, res) => {
    const verifyToken = process.env.VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === verifyToken) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Handle reply (WhatsApp webhook)
app.post('/whatsapp-webhook', (req, res) => {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from = message?.from;
    const text = message?.text?.body?.toLowerCase();

    if (text === 'yes') {
        console.log(`Order confirmed by ${from}`);
        // TODO: Update Shopify order status here
    } else if (text === 'no') {
        console.log(`Order cancelled by ${from}`);
        // TODO: Flag/cancel order in Shopify
    }

    res.sendStatus(200);
});
app.post('/shopify-webhook', express.json(), async (req, res) => {
    const order = req.body;
    console.log('🛍️ New order received from Shopify:', order);
  
    // Extract customer phone & order info
    const customerPhone = order?.customer?.phone;
    const orderId = order?.id;
  
    if (customerPhone) {
        const message = `🛍️ Hi! Your Budget Bazaar order #${orderId} is ready.\nReply with *YES* to confirm or *NO* to cancel.`;
  
      // Send WhatsApp message
      await sendWhatsAppMessage(customerPhone, message);
    }
  
    res.sendStatus(200);
  });
  
  app.post('/whatsapp-webhook', express.json(), async (req, res) => {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
  
    if (message?.text?.body) {
      const userMessage = message.text.body.trim().toLowerCase();
      const from = message.from; // customer's WhatsApp number
  
      if (userMessage === 'yes') {
        await sendWhatsAppMessage(from, `✅ Thanks! Your order is confirmed. We'll ship it soon.`);
      } else if (userMessage === 'no') {
        await sendWhatsAppMessage(from, `❌ Got it. Your order has been cancelled. If this was a mistake, reply HELP.`);
      } else {
        await sendWhatsAppMessage(from, `🤖 Sorry, I didn’t understand. Please reply with *YES* or *NO*.`);
      }
    }
  
    res.sendStatus(200);
  });
  
app.listen(3000, () => console.log("WhatsApp bot for Budget Bazaar running on port 3000"));
