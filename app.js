require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

// Initialize OpenAI configuration safely
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Universal route handling both root '/' and '/flights' for WasenderAPI webhooks
app.all(['/', '/flights'], async (req, res) => {
    // 1. PRINT RAW INCOMING DATA TO RENDER LOGS INSTANTLY
    console.log("=== INCOMING WHATSAPP BOT PAYLOAD ===");
    console.log(JSON.stringify(req.body, null, 2));

    // Handle initial browser tests or heartbeat pings
    if (req.method === 'GET') {
        return res.send('Flight Search Bot Engine is running perfectly online!');
    }

    // 2. ACKNOWLEDGE RECEIPT IMMEDIATELY TO WASENDERAPI TO PREVENT TIMEOUTS
    res.status(200).json({ status: 'received' });

    try {
        const payload = req.body;
        
        // 3. SECURELY EXTRACT WHATSAPP CHAT STRING (Directly matched to your live logs)
        let msgText = "";
        let phone = "";

        // Check if data block exists (This matches your logs precisely)
        if (payload.data) {
            phone = payload.data.senderId || payload.data.from || "";
            
            // Extract from message object if it exists inside data
            if (payload.data.message) {
                msgText = payload.data.message.conversation || payload.data.message.text || "";
            }
            
            // Fallback to top-level data keys if nested object is missing
            msgText = msgText || payload.data.messageBody || payload.data.msg || payload.data.body || "";
        }

        // Final safety fallbacks for top-level payload attributes
        msgText = msgText || payload.conversation || payload.messageBody || payload.text || payload.body || "";
        phone = phone || payload.chatId || payload.phone || payload.from || "";

        console.log(`Processed Message Text: "${msgText}" from Sender: ${phone}`);

        // If there's no actual text message content, halt execution quietly
        if (!msgText) {
            console.log("No text content found in payload. Skipping OpenAI generation.");
            return;
        }

        // 4. TRIGGER OPENAI TO PARSE FLIGHT CRITERIA
        const aiRes = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: "Extract parameters from text. Output JSON with keys: origin, destination, date. Use null if missing." 
                },
                { role: "user", content: msgText }
            ],
            response_format: { type: "json_object" }
        });

        console.log("AI Extraction Results:", aiRes.choices.message.content);
        
        // --- YOUR BACKEND API OR FLIGHT BOOKING LOGIC GOES HERE ---

    } catch (error) {
        console.error("CRITICAL ERROR IN WEBHOOK LOOP:", error.message);
    }
});

// Bind server dynamically to Render's required network port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Wakkago Flight Bot Server listening perfectly on port ${PORT}`);
});
