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

// 1. HTTP Server Root Landing Check
app.get('/', (req, res) => {
    res.status(200).send('🚀 Wakkago Production Engine is 100% Operational.');
});

// 2. Main Routing Processing Webhook
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        console.log('=== 🔔 NEW PAYLOAD ARRIVED ===');
        console.log('Raw Structure:', JSON.stringify(req.body, null, 2));

        // Immediately send back 200 OK status to close WASender execution loops
        res.status(200).json({ status: 'success' });

        // Unpack payload layouts dynamically to catch every possible WASender structure variant
        let incomingMessage = null;
        if (req.body?.data?.messages && Array.isArray(req.body.data.messages)) {
            incomingMessage = req.body.data.messages[0];
        } else if (req.body?.data) {
            incomingMessage = req.body.data;
        } else {
            incomingMessage = req.body;
        }

        // Isolate message body string parameters safely
        const incomingText = incomingMessage?.body || 
                             incomingMessage?.message?.conversation || 
                             incomingMessage?.message?.extendedTextMessage?.text || 
                             incomingMessage?.text || "";

        // Isolate target sender identification metrics
        let rawPhone = incomingMessage?.from || 
                       incomingMessage?.phone || 
                       incomingMessage?.key?.remoteJid || "";

        if (!incomingText || !rawPhone) {
            console.log('🛑 Stopped: Failed to parse required message strings or phone metrics.');
            return;
        }

        // Clean out specific session arrays if passed by server (e.g. 23470xxx@s.whatsapp.net)
        const senderPhone = rawPhone.includes('@') ? rawPhone.split('@')[0] : rawPhone;
        console.log(`Parsed Context -> Sender: [${senderPhone}] | Body Text: "${incomingText}"`);

        // Check verification command
        if (incomingText.toLowerCase().trim() === 'test') {
            await sendWhatsAppMessage(senderPhone, 'Hello! Your Render web application and Wasender webhook loop is 100% active. 🚀');
            return;
        }

        // Route strings directly to OpenAI 
        console.log('🤖 Parsing input text data layout using OpenAI LLM engine...');
        const searchParameters = await extractFlightDetails(incomingText);
        
        if (!searchParameters || !searchParameters.from_city || !searchParameters.to_city) {
            await sendWhatsAppMessage(senderPhone, "Sorry, I couldn't pick up your flight details. Please mention your origin, destination, and travel date clearly.");
            return;
        }

        // Simulate flight itineraries matching your destination targets
        const mockItineraries = [
            { airline: 'Air Peace', route: `${searchParameters.from_city.toUpperCase()} ➔ ${searchParameters.to_city.toUpperCase()} (Direct)`, price: '₦450,000' },
            { airline: 'Qatar Airways', route: `${searchParameters.from_city.toUpperCase()} ➔ ${searchParameters.to_city.toUpperCase()} (1 Stop)`, price: '₦1,250,000' }
        ];

        let messageTemplate = `✈️ *Available Flights on Wakkago.com*\n`;
        messageTemplate += `📅 Date: *${searchParameters.departure_date}*\n\n`;

        mockItineraries.forEach((flight, index) => {
            messageTemplate += `*${index + 1}. ${flight.airline}*\n`;
            messageTemplate += `🔄 Route: ${flight.route}\n`;
            messageTemplate += `💰 Price: ${flight.price}\n`;
            messageTemplate += `────────────────────\n`;
        });

        messageTemplate += `To finalize booking, reply with your choice number!`;

        await sendWhatsAppMessage(senderPhone, messageTemplate);

    } catch (error) {
        console.error('💥 Webhook runtime crash safely caught:', error.message);
    }
});

// OpenAI parsing function
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
                            from_city: { type: "string", description: "Departure city or IATA tag" },
                            to_city: { type: "string", description: "Target arrival location identity" },
                            departure_date: { type: "string", description: "Target travel date string" }
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
        console.error('❌ OpenAI Interruption Error:', error.message);
        return null;
    }
}

// Outbound API Caller Delivery Interface 
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

        console.log(`📤 Dispatching payload schema to WASender:`, JSON.stringify(payload));

        const response = await axios.post(WASENDER_API_URL, payload, {
            headers: { 
                'Authorization': `Bearer ${WASENDER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ Outbound execution accepted status:`, response.data);
    } catch (error) {
        console.error('❌ Outbound Network Error Response:', error.response?.data || error.message);
    }
}

app.listen(PORT, () => console.log(`🚀 Automation pipeline running live on port ${PORT}`));
