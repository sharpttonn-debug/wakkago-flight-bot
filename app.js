import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const WASENDER_TOKEN = process.env.WASENDER_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WASENDER_API_URL = 'https://wasenderapi.com'; 

// 1. Browser Health Check Route
app.get('/', (req, res) => {
    res.status(200).send('🚀 Wakkago Production Engine is Online, Stable, and Monitoring Webhooks!');
});

// 2. Core Incoming Webhook Router Endpoint
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        console.log('=== 🔔 NEW WEBHOOK PAYLOAD INBOUND ===');
        console.log('Raw Received JSON:', JSON.stringify(req.body, null, 2));

        // Always reply with a 200 OK status immediately to acknowledge data packet receipt
        res.status(200).json({ status: 'success' });

        // Safely extract the inner event object wrapper sent by WASenderAPI streams
        const payloadData = req.body?.data?.messages || req.body?.data || req.body;
        const msgObject = Array.isArray(payloadData) ? payloadData[0] : payloadData;

        // Isolate incoming phone paths
        let rawPhone = msgObject?.key?.remoteJid || msgObject?.from || msgObject?.phone || "";
        
        // Isolate incoming text values
        let incomingText = msgObject?.messageBody || 
                           msgObject?.body || 
                           msgObject?.message?.conversation || 
                           msgObject?.text || "";

        if (!rawPhone || !incomingText) {
            console.log('🛑 Inbound data parsing did not match formatting criteria properties.');
            return;
        }

        // Clean out WhatsApp net domain parameters if attached to variable string instances
        const senderPhone = rawPhone.includes('@') ? rawPhone.split('@')[0] : rawPhone;
        console.log(`Parsed Live Target Context -> Phone: [${senderPhone}] | Message Body Text: "${incomingText}"`);

        // Trigger immediate connection path verification
        if (incomingText.toLowerCase().trim() === 'test') {
            console.log('🎯 Verification match flagged! Pushing direct response reply...');
            await sendWhatsAppMessage(senderPhone, 'Hello! Your Render web application and Wasender webhook loop is 100% active. 🚀');
            return;
        }

        // Route strings directly to OpenAI GPT parsing pipeline matrices
        console.log('🤖 Invoking OpenAI structured data schema extractor layer...');
        const searchParameters = await extractFlightDetails(incomingText);
        
        if (!searchParameters || !searchParameters.from_city || !searchParameters.to_city) {
            console.log('⚠️ OpenAI returned an incomplete parameter map missing departure/destination attributes.');
            await sendWhatsAppMessage(senderPhone, "Sorry, I couldn't pick up your flight details. Please mention your origin, destination, and travel date clearly.");
            return;
        }

        // Generate baseline static itinerary block for functional verification
        const mockItineraries = [
            { airline: 'Air Peace', route: `${searchParameters.from_city.toUpperCase()} ➔ ${searchParameters.to_city.toUpperCase()} (Direct)`, price: '₦450,000' },
            { airline: 'Qatar Airways', route: `${searchParameters.from_city.toUpperCase()} ➔ ${searchParameters.to_city.toUpperCase()} (1 Stop)`, price: '₦1,250,000' }
        ];

        let layoutMessage = `✈️ *Available Flights on Wakkago.com*\n`;
        layoutMessage += `📅 Date: *${searchParameters.departure_date}*\n\n`;

        mockItineraries.forEach((flight, index) => {
            layoutMessage += `*${index + 1}. ${flight.airline}*\n`;
            layoutMessage += `🔄 Route: ${flight.route}\n`;
            layoutMessage += `💰 Price: ${flight.price}\n`;
            layoutMessage += `────────────────────\n`;
        });

        layoutMessage += `To finalize your booking, reply with your choice number!`;

        await sendWhatsAppMessage(senderPhone, layoutMessage);

    } catch (error) {
        console.error('💥 Webhook internal core processing runtime fault exception:', error.message);
    }
});

// OpenAI JSON Structured Layout Schema Logic
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
                            from_city: { type: "string", description: "Departure origin city name or IATA airport code" },
                            to_city: { type: "string", description: "Target arrival destination city name or IATA code" },
                            departure_date: { type: "string", description: "Target travel calendar date mapped cleanly" }
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
        console.error('❌ OpenAI API Parameter configuration exception:', error.message);
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

app.listen(PORT, () => console.log(`🚀 Automated routing manager core online on port ${PORT}`));
