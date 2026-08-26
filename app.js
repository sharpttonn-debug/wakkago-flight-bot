
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const WASENDER_TOKEN = process.env.WASENDER_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Official endpoint target matching your active dashboard instance CLI string layout
const WASENDER_API_URL = 'https://wasenderapi.com'; 

// 1. Core HTTP Browser Landing Route Verification
app.get('/', (req, res) => {
    res.status(200).send('🚀 Wakkago Production Automation Engine is Live & Syncing!');
});

// 2. Primary Webhook Entry Router Endpoint
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        console.log('=== 🔔 NEW WEBHOOK PAYLOAD INBOUND ===');
        console.log('Raw Received Data:', JSON.stringify(req.body, null, 2));

        // Always reply with a 200 OK immediately so WASender closes the connection cleanly
        res.status(200).json({ status: 'success' });

        // Safely capture payload models from deep nested structures or flat objects
        const incomingData = req.body?.data?.messages?.[0] || req.body?.data || req.body;
        
        // Extract sender parameters using explicit documented properties
        let rawPhone = incomingData?.key?.remoteJid || 
                       incomingData?.from || 
                       incomingData?.phone || "";

        // Extract message content text strings safely
        let incomingText = incomingData?.messageBody || 
                           incomingData?.body || 
                           incomingData?.message?.conversation || 
                           incomingData?.text || "";

        if (!rawPhone) {
            console.log('🛑 Aborting: Unable to isolate clean recipient phone parameters.');
            return;
        }

        // Clean out WhatsApp net domain extensions if attached to the variable (e.g. 234xxx@s.whatsapp.net)
        const senderPhone = rawPhone.includes('@') ? rawPhone.split('@')[0] : rawPhone;
        
        if (!incomingText || incomingText.trim() === '') {
            console.log('🛑 Aborting: Received message content text string is empty.');
            return;
        }

        console.log(`Parsed Targets -> Phone: [${senderPhone}] | Body Text: "${incomingText}"`);

        // Bypass command to test basic webhook loop functionality instantly
        if (incomingText.toLowerCase().trim() === 'test') {
            console.log('🎯 Diagnostic test command matched! Dispatching immediate echo response card...');
            await sendWhatsAppMessage(senderPhone, 'Hello! Your Render web application and Wasender webhook loop is 100% active. 🚀');
            return;
        }

        // Route natural text sentences over to OpenAI parsing matrix pipelines
        console.log('🤖 Invoking OpenAI structured data schema extractor layer...');
        const searchParameters = await extractFlightDetails(incomingText);
        
        if (!searchParameters || !searchParameters.from_city || !searchParameters.to_city) {
            console.log('⚠️ OpenAI returned an incomplete parameter map missing departure/destination values.');
            await sendWhatsAppMessage(senderPhone, "Sorry, I couldn't pick up your flight details. Please mention your origin, destination, and travel date clearly.");
            return;
        }

        // Generate baseline simulated flight data array matching your parsed choices
        const mockItineraries = [
            { airline: 'Air Peace', route: `${searchParameters.from_city.toUpperCase()} ➔ ${searchParameters.to_city.toUpperCase()} (Direct)`, price: '₦450,000' },
            { airline: 'Qatar Airways', route: `${searchParameters.from_city.toUpperCase()} ➔ ${searchParameters.to_city.toUpperCase()} (1 Stop)`, price: '₦1,250,000' }
        ];

        let layoutMessage = `✈️ *Available Flights on Wakkago.com*\n`;
        layoutMessage += `📅 Travel Date: *${searchParameters.departure_date}*\n\n`;

        mockItineraries.forEach((flight, index) => {
            layoutMessage += `*${index + 1}. ${flight.airline}*\n`;
            layoutMessage += `🔄 Route: ${flight.route}\n`;
            layoutMessage += `💰 Price: ${flight.price}\n`;
            layoutMessage += `────────────────────\n`;
        });

        layoutMessage += `To finalize your booking, please respond with your option choice number!`;

        await sendWhatsAppMessage(senderPhone, layoutMessage);

    } catch (error) {
        console.error('💥 Webhook process exception runtime exception caught:', error.message);
    }
});

// OpenAI Context Layout Schema Parser Logic
async function extractFlightDetails(userMessage) {
    try {
        const response = await axios.post('https://openai.com', {
            model: 'gpt-4o-mini', 
            messages: [
                {
                    role: 'system',
                    content: 'Extract flight search parameters from the user text. Convert travel dates precisely to standard YYYY-MM-DD format. Assume the current calendar year is 2026. Respond strictly with JSON format.'
                },
                { role: 'user', content: userMessage }
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "flight_parser",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            from_city: { type: "string", description: "Departure origin city name or airport code" },
                            to_city: { type: "string", description: "Target arrival location identity metric" },
                            departure_date: { type: "string", description: "Target travel date string formatting" }
                        },
                        required: ["from_city", "to_city", "departure_date"],
                        additionalProperties: false
                    }
                }
            }
        }, {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
        });

        return JSON.parse(response.data.choices.message.content);
    } catch (error) {
        console.error('❌ OpenAI Parameter parsing layer exception:', error.message);
        return null;
    }
}

// Global Outbound Message Dispatch Controller
async function sendWhatsAppMessage(recipient, messageBody) {
    try {
        const payload = {
            to: recipient.toString().trim(),
            text: messageBody
        };

        console.log(`📤 Sending payload properties to WASender REST system:`, JSON.stringify(payload));

        const response = await axios.post(WASENDER_API_URL, payload, {
            headers: { 
                'Authorization': `Bearer ${WASENDER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ Outbound messaging delivery successfully completed:`, response.data);
    } catch (error) {
        console.error('❌ Outbound Network Pipeline Request Failure:', error.response?.data || error.message);
    }
}

app.listen(PORT, () => console.log(`🚀 Flight automation engine active on internal port ${PORT}`));
