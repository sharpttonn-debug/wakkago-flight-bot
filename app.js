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

// 1. Browser Status Route
app.get('/', (req, res) => {
    res.status(200).send('🚀 Wakkago Testing Engine is fully functional!');
});

// 2. Core Incoming Webhook Handler
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        console.log('=== 🔔 NEW LIVE PAYLOAD INBOUND ===');
        
        // Handle varying nested payload variants gracefully
        const messagePayload = req.body?.data || req.body;
        const senderPhone = messagePayload?.from || messagePayload?.phone || messagePayload?.sender;
        const incomingText = messagePayload?.body || messagePayload?.message || messagePayload?.text;

        // Acknowledge receipt to Wasender immediately
        res.status(200).send({ status: 'received' });

        if (!incomingText || !senderPhone) return;

        console.log(`Processing -> Phone: ${senderPhone} | Text: "${incomingText}"`);

        // Bypass command to verify structural connectivity
        if (incomingText.toLowerCase().trim() === 'test') {
            await sendWhatsAppMessage(senderPhone, 'Hello! Your Render web application and Wasender webhook loop is 100% active. 🚀');
            return;
        }

        // Send text to OpenAI to parse search requirements
        const searchParameters = await extractFlightDetails(incomingText);
        
        if (!searchParameters || !searchParameters.from_city || !searchParameters.to_city) {
            await sendWhatsAppMessage(senderPhone, "Sorry, I couldn't pick up your flight details. Please mention your origin, destination, and travel date clearly.");
            return;
        }

        // Simulate flight data results based on parsed parameters
        const mockItineraries = [
            { airline: 'Air Peace', route: `${searchParameters.from_city} ➔ ${searchParameters.to_city} (Direct)`, price: '₦450,000' },
            { airline: 'Qatar Airways', route: `${searchParameters.from_city} ➔ ${searchParameters.to_city} (1 Stop)`, price: '₦1,250,000' }
        ];

        // Format a clean, human-readable WhatsApp itinerary responsecard
        let responseCard = `✈️ *Available Flights on Wakkago.com*\n`;
        responseCard += `📅 Travel Date: *${searchParameters.departure_date}*\n\n`;

        mockItineraries.forEach((flight, index) => {
            responseCard += `*${index + 1}. ${flight.airline}*\n`;
            responseCard += `🔄 Route: ${flight.route}\n`;
            responseCard += `💰 Price: ${flight.price}\n`;
            responseCard += `────────────────────\n`;
        });

        responseCard += `To finalize booking, reply with your choice number!`;

        await sendWhatsAppMessage(senderPhone, responseCard);

    } catch (error) {
        console.error('Webhook Error:', error.message);
    }
});

// OpenAI Structural Extractor Layer
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
                            from_city: { type: "string", description: "Departure city name or IATA code" },
                            to_city: { type: "string", description: "Arrival destination city name or IATA code" },
                            departure_date: { type: "string", description: "Travel calendar date" }
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
        console.error('OpenAI Error:', error.message);
        return null;
    }
}

// Outbound Response Delivery Engine
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

        await axios.post(WASENDER_API_URL, payload, {
            headers: { 
                'Authorization': `Bearer ${WASENDER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Response dispatched to ${recipient}`);
    } catch (error) {
        console.error('❌ Outbound Network Error:', error.response?.data || error.message);
    }
}

app.listen(PORT, () => console.log(`Server executing flawlessly on port ${PORT}`));
