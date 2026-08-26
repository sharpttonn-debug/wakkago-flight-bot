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
    // FORCE ACKNOWLEDGE INSTANTLY TO PREVENT DUPLICATE LOOPS
    res.sendStatus(200);

    // CRITICAL DIAGNOSTIC: This will print regardless of data structure
    console.log("🚨 WEBHOOK HIT! Connection from WaSender confirmed.");
    console.log("📦 Received Data Object:", JSON.stringify(req.body));

    try {
        const payload = req.body;
        if (!payload || Object.keys(payload).length === 0) {
            console.log("⚠️ Webhook received completely empty data fields.");
            return;
        }

        // Broad fallback extraction paths to match any variation of WaSender payload schemas
        const incomingMsg = payload.message || payload.data || payload;
        const sender = payload.sender || payload.contact || {};

        const userPhone = incomingMsg.from || incomingMsg.phone || sender.phone || payload.wid || payload.from;
        const userText = incomingMsg.text || incomingMsg.body || (incomingMsg.message ? incomingMsg.message.text : null) || payload.messageText;

        if (!userPhone || !userText) {
            console.log(`⚠️ Data extraction skipped. Parsed Phone: [${userPhone}], Parsed Text: [${userText}]`);
            return;
        }

        // Pass parsed string attributes forward to processing engine
        await processFlightBotFlow(String(userPhone).trim(), String(userText).trim());

    } catch (err) {
        console.error("❌ Error parsing webhook dataset details:", err.message);
    }
});

// CORE FLOW ENGINE: Manages AI extractions and state workflow routing
async function processFlightBotFlow(phone, text) {
    console.log(`💬 Processing message from [${phone}]: "${text}"`);

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
            model: "gpt-4o-mini",
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

        // FIXED ARRAY ACCESSIBILITY GUARDRAILS
        if (completion && completion.choices && completion.choices[0] && completion.choices[0].message) {
            const extractionResult = completion.choices[0].message.content.trim();
            console.log("🎉 ENGINE SUCCESS! AI Extraction Results:", extractionResult);

            let flightData;
            try {
                flightData = JSON.parse(extractionResult);
            } catch (jsonErr) {
                const cleanJson = extractionResult.replace(/```json|```/g, "").trim();
                flightData = JSON.parse(cleanJson);
            }

            if (flightData.origin && flightData.destination && flightData.departure_date) {
                const confirmationMsg = `✅ *Flight Search Confirmed!*\n\n🛫 *From:* ${flightData.origin}\n🛬 *To:* ${flightData.destination}\n📅 *Date:* ${flightData.departure_date}\n\n_Searching available flights across Wakkago systems..._`;
                await sendWhatsAppMessage(phone, confirmationMsg);

                // --- INTEGRATE YOUR WAKKAGO API / LIVE FLIGHT SEARCH LOGIC HERE ---
                
                delete userSessions[phone]; 
            } else {
                const missingMsg = "⚠️ I couldn't capture all flight parameters clearly. Please specify your *Origin*, *Destination*, and *Departure Date* explicitly.";
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
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏁 Server fully initialized. Listening locally on port ${PORT}`);
});
