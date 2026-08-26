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

// Temporary state management (Use Redis on Render for production environments)
const userSessions = {};

// Root Route for Health Check
app.get('/', (req, res) => {
    res.status(200).send('🚀 Wakkago Flight Automation Backend is running live!');
});

// MAIN WEBHOOK: Listens for incoming WhatsApp messages via WaSender
app.post('/webhook/whatsapp', async (req, res) => {
    // 1. Instantly acknowledge message receipt to WaSender to prevent duplicate loops
    res.sendStatus(200);

    try {
        const payload = req.body;
        console.log("📥 Incoming WaSender Webhook Payload:", JSON.stringify(payload));

        // Adjust paths safely based on WaSender payload configuration structure
        const incomingMsg = payload.message || payload.data || payload;
        const sender = payload.sender || payload.contact || {};

        const userPhone = incomingMsg.from || incomingMsg.phone || sender.phone;
        const userText = incomingMsg.text || incomingMsg.body || (incomingMsg.message ? incomingMsg.message.text : null);

        if (!userPhone || !userText) {
            console.log("⚠️ Skipping payload: Missing phone number or text body.");
            return;
        }

        // 2. Pass data forward to processing engine
        await processFlightBotFlow(userPhone.trim(), userText.trim());

    } catch (err) {
        console.error("❌ Webhook processing error:", err.message);
    }
});

// CORE FLOW ENGINE: Manages AI extractions and state workflow routing
async function processFlightBotFlow(phone, text) {
    console.log(`💬 Processing message from [${phone}]: "${text}"`);

    // Clean greeting triggers to wake up the assistant
    const lowerText = text.toLowerCase();
    const isGreeting = ['hi', 'hello', 'hey', 'start', 'menu', 'wakkago'].some(word => lowerText === word);

    if (isGreeting || !userSessions[phone]) {
        userSessions[phone] = { step: 'AWAITING_FLIGHT_DETAILS' };
        
        const welcomeMessage = "✈️ *Welcome to Wakkago Flight Automation!* \n\nPlease tell me your travel details in a single sentence.\n\n_Example: \"I need flight tickets from Abuja to London 29 September\"_";
        await sendWhatsAppMessage(phone, welcomeMessage);
        return;
    }

    // Process structured data using OpenAI
    try {
        console.log("🤖 Forwarding user input text directly to OpenAI extraction parsing...");

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Cost-effective, high-speed structured extraction model
            messages: [
                {
                    role: "system",
                    content: "You are a data extraction assistant for Wakkago.com flights. Extract the origin city, destination city, and departure date from the user text. Respond strictly with a clean, raw valid JSON block containing fields: origin, destination, departure_date. Use YYYY-MM-DD format for date. If the year is omitted, assume the next upcoming instance of that month. If missing any field, set its value to null. Do not include markdown wraps like ```json or any conversational text."
                },
                {
                    role: "user",
                    content: text
                }
            ],
            temperature: 0.1
        });

        // FIXED: Added absolute [0] index array guardrails to strictly match OpenAI latest SDK response layouts
        if (completion && completion.choices && completion.choices[0] && completion.choices[0].message) {
            const extractionResult = completion.choices[0].message.content.trim();
            console.log("🎉 ENGINE SUCCESS! AI Extraction Results:", extractionResult);

            // Parse text values safely into an executable data object
            let flightData;
            try {
                flightData = JSON.parse(extractionResult);
            } catch (jsonErr) {
                // Fallback clean if markdown codeblocks leak through system prompts
                const cleanJson = extractionResult.replace(/```json|```/g, "").trim();
                flightData = JSON.parse(cleanJson);
            }

            // Route next step to user based on parameters collected
            if (flightData.origin && flightData.destination && flightData.departure_date) {
                const confirmationMsg = `✅ *Flight Search Confirmed!*\n\n🛫 *From:* ${flightData.origin}\n🛬 *To:* ${flightData.destination}\n📅 *Date:* ${flightData.departure_date}\n\n🔎 _Searching available flights across Wakkago systems. Please hold on..._`;
                await sendWhatsAppMessage(phone, confirmationMsg);

                // --- INTEGRATE YOUR WAKKAGO API / LIVE FLIGHT SEARCH LOGIC HERE ---
                
                delete userSessions[phone]; // Clean session memory on terminal loops
            } else {
                const missingMsg = "⚠️ I couldn't capture all flight parameters clearly. Please make sure to specify your *Origin*, *Destination*, and *Departure Date* details explicitly.";
                await sendWhatsAppMessage(phone, missingMsg);
            }

        } else {
            console.error("⚠️ OpenAI returned empty choices payload structure:", JSON.stringify(completion));
        }

    } catch (openAiError) {
        console.error("❌ OpenAI API Session Connection Failed:", openAiError.message);
        await sendWhatsAppMessage(phone, "⚠️ Sorry, I am experiencing network synchronization delays parsing your flight schedule. Please try again in a few moments.");
    }
}

// OUTBOUND DELIVERY GATEWAY: Delivers data back to user handset screen via WaSender HTTP Endpoint API
async function sendWhatsAppMessage(toPhone, textMessage) {
    const instanceId = process.env.WASENDER_INSTANCE_ID;
    const apiToken = process.env.WASENDER_API_TOKEN;

    if (!instanceId || !apiToken) {
        console.error("❌ Messaging Aborted: Missing WASENDER_INSTANCE_ID or WASENDER_API_TOKEN in environment setups.");
        return;
    }

    try {
        // Adjust endpoint route structure to match your target WaSender deployment service format
        const response = await axios.post(`https://wasenderapi.com`, {
            instance_id: instanceId,
            token: apiToken,
            to: toPhone,
            body: textMessage
        });
        console.log(`📤 Dispatching WhatsApp reply out via WaSender to [${toPhone}]: Status ${response.status}`);
    } catch (err) {
        console.error(`❌ Outbound WaSender Delivery Failed to [${toPhone}]:`, err.response ? err.response.data : err.message);
    }
}

// Port Configuration binding for cloud infrastructure stability
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏁 Server fully initialized. Listening locally on port ${PORT}`);
});
