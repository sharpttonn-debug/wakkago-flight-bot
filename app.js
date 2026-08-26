const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Temporary session tracker
const userSessions = {};

// Health check root route
app.get('/', (req, res) => {
    res.status(200).send('🚀 Wakkago Flight System is Online');
});

// MAIN WEBHOOK LINK
app.post('/webhook/whatsapp', async (req, res) => {
    // 1. Send status OK instantly so WaSender doesn't timeout
    res.sendStatus(200);

    // 2. CRITICAL GLOBAL LOG: Print every single transaction to the screen
    console.log("🚨 SYSTEM WEBHOOK RECEIVED A TRIGGER!");
    console.log("📦 RAW OBJECT DATA RECEIVED:", JSON.stringify(req.body));

    try {
        const payload = req.body;
        
        // Match varied webhook structures flexibly
        const msg = payload.message || payload.data || payload;
        const sender = payload.sender || payload.contact || {};

        const phone = msg.from || msg.phone || sender.phone || payload.wid || payload.from;
        const text = msg.text || msg.body || (msg.message ? msg.message.text : null) || payload.messageText;

        if (!phone || !text) {
            console.log("⚠️ Payload skipped: Missing phone identification or text body keys.");
            return;
        }

        console.log(`💬 Processing pipeline message from [${phone}]: "${text}"`);

        // Check if greeting
        const lowerText = String(text).toLowerCase().trim();
        const isGreeting = ['hi', 'hello', 'hey', 'start', 'menu', 'wakkago'].some(word => lowerText === word);

        if (isGreeting || !userSessions[phone]) {
            userSessions[phone] = { step: 'AWAITING_FLIGHT_DETAILS' };
            const welcome = "✈️ *Welcome to Wakkago Flight Automation!* \n\nPlease tell me your travel details in a single sentence.\n\n_Example: \"I need flight tickets from Abuja to London 29 September\"_";
            await sendWhatsAppMessage(phone, welcome);
            return;
        }

        // Call OpenAI Extraction
        console.log("🤖 Requesting parameters from OpenAI extraction engine...");
        const aiRes = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Extract origin, destination, and departure_date as clean JSON properties. Do not use markdown blocks."
                },
                {
                    role: "user",
                    content: String(text)
                }
            ],
            temperature: 0.1
        });

        // REVERSED & PROTECTED ACCESS LAYER:
        // Try BOTH the new format and the old format to guarantee execution safely
        let extractionResult = null;
        
        if (aiRes && aiRes.choices && aiRes.choices[0] && aiRes.choices[0].message) {
            // Your original array style fix [0]
            extractionResult = aiRes.choices[0].message.content;
        } else if (aiRes && aiRes.choices && aiRes.choices.message) {
            // Alternative library style fallback
            extractionResult = aiRes.choices.message.content;
        }

        if (extractionResult) {
            console.log("🎉 ENGINE SUCCESS! AI Extraction Results:", extractionResult);
            
            // Send back summary details to customer
            const replyMsg = `✅ *Flight System Parsed Details:*\n\n${extractionResult}`;
            await sendWhatsAppMessage(phone, replyMsg);
            
            delete userSessions[phone];
        } else {
            console.log("⚠️ Could not extract data content out from the aiRes payload structure:", JSON.stringify(aiRes));
        }

    } catch (globalError) {
        console.error("❌ Deep error execution exception:", globalError.message);
    }
});

// Outbound Messaging Router
async function sendWhatsAppMessage(toPhone, textMessage) {
    const instanceId = process.env.WASENDER_INSTANCE_ID;
    const apiToken = process.env.WASENDER_API_TOKEN;

    if (!instanceId || !apiToken) {
        console.error("❌ Messaging credentials unconfigured in environment values.");
        return;
    }

    try {
        await axios.post(`https://wasenderapi.com`, {
            instance_id: instanceId,
            token: apiToken,
            to: toPhone,
            body: textMessage
        });
        console.log(`📤 Message delivered out to [${toPhone}]`);
    } catch (err) {
        console.error(`❌ Send message breakdown error:`, err.message);
    }
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏁 Server listening completely open on port ${PORT}`);
});
