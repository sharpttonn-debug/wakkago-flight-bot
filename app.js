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

// Temporary session state manager
const userSessions = {};

// Root Route for Base Infrastructure Health Checks
app.get('/', (req, res) => {
    res.status(200).send('🚀 Wakkago Flight Automation Engine is fully online!');
});

// MAIN WEBHOOK LINK: Listens for incoming WhatsApp messages
app.post('/webhook/whatsapp', async (req, res) => {
    // 1. Force acknowledge instantly back to WaSender gateway
    res.sendStatus(200);

    // 2. EMERGENCY DIAGNOSTIC LOG (Will trigger on ANY connection attempt)
    console.log("🚨 RECEIVING INCOMING TRAFFIC! Webhook contact from WaSender verified.");
    console.log("📦 RAW PAYLOAD RECEIVED:", JSON.stringify(req.body));

    try {
        const payload = req.body;
        if (!payload || Object.keys(payload).length === 0) {
            console.log("⚠️ Payload rejected: Webhook packet contains empty body fields.");
            return;
        }

        // Flexible structural fallbacks to locate attributes across WaSender versions
        const dataContainer = payload.message || payload.data || payload;
        const contactDetails = payload.sender || payload.contact || {};

        const userPhone = dataContainer.from || dataContainer.phone || contactDetails.phone || payload.wid || payload.from;
        const userText = dataContainer.text || dataContainer.body || (dataContainer.message ? dataContainer.message.text : null) || payload.messageText;

        if (!userPhone || !userText) {
            console.log(`⚠️ Pipeline skipped: Unable to capture standard target keys. Phone: [${userPhone}], Text: [${userText}]`);
            return;
        }

        // 3. Forward parameters to processing workflow
        await processFlightBotFlow(String(userPhone).trim(), String(userText).trim());

    } catch (err) {
        console.error("❌ Webhook crash exception encountered:", err.message);
    }
});

// SYSTEM WORKFLOW ROUTING ENGINE
async function processFlightBotFlow(phone, text) {
    console.log(`💬 Processing incoming string payload from [${phone}]: "${text}"`);

    const lowerText = text.toLowerCase().trim();
    const isGreeting = ['hi', 'hello', 'hey', 'start', 'menu', 'wakkago'].some(word => lowerText === word);

    if (isGreeting || !userSessions[phone]) {
        userSessions[phone] = { step: 'AWAITING_FLIGHT_DETAILS' };
        
        const welcomeMessage = "✈️ *Welcome to Wakkago Flight Automation!* \n\nPlease tell me your travel details in a single sentence.\n\n_Example: \"I need flight tickets from Abuja to London 29 September\"_";
        await sendWhatsAppMessage(phone, welcomeMessage);
        return;
    }

    try {
        console.log("🤖 Forwarding user input text directly to OpenAI extraction parsing...");

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Extract origin, destination, and departure_date from the user text as clean JSON. Use format YYYY-MM-DD for dates. Set missing fields to null. Do not include markdown blocks."
                },
                {
                    role: "user",
                    content: text
                }
            ],
            temperature: 0.1
        });

        // DUAL-COMPATIBILITY SAFE EXTRACTOR (Bypasses all legacy and update errors)
        let extractionResult = null;
        
        if (completion && completion.choices && completion.choices[0] && completion.choices[0].message) {
            // Standard historical index extraction format
            extractionResult = completion.choices[0].message.content;
        } else if (completion && completion.choices && completion.choices.message) {
            // Direct object extraction layout version match
            extractionResult = completion.choices.message.content;
        }

        if (extractionResult) {
            console.log("🎉 ENGINE SUCCESS! AI Extraction Results:", extractionResult);

            let flightData;
            try {
                flightData = JSON.parse(extractionResult.trim());
            } catch (jsonErr) {
                const cleanJson = extractionResult.replace(/```json|```/g, "").trim();
                flightData = JSON.parse(cleanJson);
            }

            if (flightData.origin && flightData.destination && flightData.departure_date) {
                const confirmationMsg = `✅ *Flight Search Confirmed!*\n\n🛫 *From:* ${flightData.origin}\n🛬 *To:* ${flightData.destination}\n📅 *Date:* ${flightData.departure_date}\n\n_Searching available flights across Wakkago systems. Please hold on..._`;
                await sendWhatsAppMessage(phone, confirmationMsg);
                
                delete userSessions[phone]; 
            } else {
                await sendWhatsAppMessage(phone, "⚠️ I couldn't capture all flight parameters clearly. Please verify your *Origin*, *Destination*, and *Departure Date* details.");
            }
        } else {
            console.error("⚠️ Extraction Aborted: OpenAI returned an empty response structure.");
        }

    } catch (openAiError) {
        console.error("❌ OpenAI API Session Connection Failed:", openAiError.message);
        await sendWhatsAppMessage(phone, "⚠️ Sorry, I am experiencing network synchronization delays parsing your flight schedule.");
    }
}

// OUTBOUND DELIVERY GATEWAY VIA WASENDER
async function sendWhatsAppMessage(toPhone, textMessage) {
    const instanceId = process.env.WASENDER_INSTANCE_ID;
    const apiToken = process.env.WASENDER_API_TOKEN;

    if (!instanceId || !apiToken) {
        console.error("❌ Messaging Aborted: Missing WASENDER_INSTANCE_ID or WASENDER_API_TOKEN in environment setups.");
        return;
    }

    try {
        await axios.post(`https://wasenderapi.com`, {
            instance_id: instanceId,
            token: apiToken,
            to: toPhone,
            body: textMessage
        });
        console.log(`📤 Dispatching WhatsApp reply out via WaSender to [${toPhone}]`);
    } catch (err) {
        console.error(`❌ Outbound WaSender Delivery Failed:`, err.message);
    }
}

// Port Configuration binding
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏁 Server fully initialized. Listening locally on port ${PORT}`);
});
