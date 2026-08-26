import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const WASENDER_TOKEN = process.env.WASENDER_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WASENDER_DEVICE_ID = process.env.WASENDER_DEVICE_ID;
const WASENDER_API_URL = 'https://wasenderapi.com'; 

// 1. Base Domain Landing Status Endpoint
app.get('/', (req, res) => {
    res.status(200).send('🚀 Wakkago Production Engine is 100% Active.');
});

// 2. Incoming WASender API Event Router Webhook
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        console.log('=== 🔔 NEW INBOUND WEBHOOK PAYLOAD ===');
        console.log('JSON Payload Object:', JSON.stringify(req.body, null, 2));

        // Acknowledge event receipt immediately to clean up pipeline connection latency
        res.status(200).json({ status: 'success' });

        // Isolate primary data blocks sent over messages.received or messages.upsert streams
        const payloadData = req.body?.data || req.body;
        
        // Extract incoming chat body content mapping across multi-version legacy formats
        const incomingText = payloadData?.messageBody || 
                             payloadData?.message?.conversation || 
                             payloadData?.message?.extendedTextMessage?.text || 
                             payloadData?.body || "";

        // Extract phone number strictly adhering to WASender documentation models
        let targetPhone = payloadData?.key?.cleanedSenderPn || 
                          payloadData?.key?.remoteJid || 
                          payloadData?.from || 
                          payloadData?.phone || "";

        if (!incomingText || !targetPhone) {
            console.log('🛑 Aborting pipeline execution: Missing text content or tracking headers.');
            return;
        }

        // Clean out WhatsApp net domain parameters if attached to variable string instances
        const cleanPhone = targetPhone.includes('@') ? targetPhone.split('@')[0] : targetPhone;
        console.log(`Successfully Extracted Data -> Phone: [${cleanPhone}] | Input Text: "${incomingText}"`);

        // Immediate direct path processing bypass flag for end-to-end loop diagnostic validation
        if (incomingText.toLowerCase().trim() === 'test') {
            console.log('🎯 Verification match flagged. Routing direct output message reply...');
            await sendWhatsAppMessage(cleanPhone, 'Hello! Your Render web application and Wasender webhook loop is 100% active. 🚀');
            return;
        }

        // Forward raw text configuration parameter layout block over into OpenAI processing matrix
        console.log('🤖 Invoking OpenAI GPT structured data parser layer...');
        const searchParameters = await extractFlightDetails(incomingText);
        
        if (!searchParameters || !searchParameters.from_city || !searchParameters.to_city) {
            console.log('⚠️ OpenAI returned an incomplete parameter map missing departure/destination attributes.');
            await sendWhatsAppMessage(cleanPhone, "Sorry, I couldn't pick up your flight details. Please mention your origin, destination, and travel date clearly.");
            return;
        }

        // Emulate flight payload layout arrays mapping key tracking options
        const mockItineraries = [
            { airline: 'Air Peace', route: `${searchParameters.from_city.toUpperCase()} ➔ ${searchParameters.to_city.toUpperCase()} (Direct)`, price: '₦450,000' },
            { airline: 'Qatar Airways', route: `${searchParameters.from_city.toUpperCase()} ➔ ${searchParameters.to_city.toUpperCase()} (1 Stop)`, price: '₦1,250,000' }
        ];

        let structuredMessage = `✈️ *Available Flights on Wakkago.com*\n`;
        structuredMessage += `📅 Date: *${searchParameters.departure_date}*\n\n`;

        mockItineraries.forEach((flight, index) => {
            structuredMessage += `*${index + 1}. ${flight.airline}*\n`;
            structuredMessage += `🔄 Route: ${flight.route}\n`;
            structuredMessage += `💰 Price: ${flight.price}\n`;
            structuredMessage += `────────────────────\n`;
        });

        structuredMessage += `To finalize booking, reply with your choice number!`;

        await sendWhatsAppMessage(cleanPhone, structuredMessage);

    } catch (error) {
        console.error('💥 Webhook engine global process runtime catch block triggered:', error.message);
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
                            from_city: { type: "string", description: "Departure origin city name or IATA airport context value" },
                            to_city: { type: "string", description: "Target arrival location city identity" },
                            departure_date: { type: "string", description: "Travel calendar date execution query" }
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
        console.error('❌ OpenAI context layout mapping execution exception:', error.message);
        return null;
    }
}

// Global Outbound Delivery Endpoint Request Disptacher Block
async function sendWhatsAppMessage(recipient, messageBody) {
    try {
        const payload = {
            to: recipient,
            type: 'text',
            text: messageBody
        };

        if (WASENDER_DEVICE_ID) {
            payload.device_id = WASENDER_DEVICE_ID;
        }

        console.log(`📤 Forwarding serialized payload array properties to WASender REST system:`, JSON.stringify(payload));

        const response = await axios.post(WASENDER_API_URL, payload, {
            headers: { 
                'Authorization': `Bearer ${WASENDER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ Outbound transaction success status response:`, response.data);
    } catch (error) {
        console.error('❌ Outbound Network Pipeline Delivery Request Failure:', error.response?.data || error.message);
    }
}

app.listen(PORT, () => console.log(`🚀 Wakkago active flight manager operating live on internal port ${PORT}`));
