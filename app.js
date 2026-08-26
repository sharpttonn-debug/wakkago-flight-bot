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

// Official endpoint target matching your WASender version documentation
const WASENDER_API_URL = 'https://wasenderapi.com'; 

// Browser verification landing route
app.get('/', (req, res) => {
    res.status(200).send('🚀 Wakkago Production Server is Live & Listening!');
});

// Primary Webhook Entry Endpoint
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        console.log('=== 🔔 NEW WEBHOOK EVENT RECEIVED ===');
        console.log('Payload Body:', JSON.stringify(req.body, null, 2));

        // Always reply with a 200 OK immediately so WASender knows the packet was delivered successfully
        res.status(200).json({ status: 'success' });

        // Unpack payload paths safely to protect against unexpected structure mutations
        const messageContainer = req.body?.data?.messages || req.body?.data || req.body;
        
        // Extract incoming phone values
        let rawPhone = messageContainer?.key?.remoteJid || 
                       messageContainer?.from || 
                       messageContainer?.phone || "";

        // Extract incoming chat body text based explicitly on WASender activity logs
        let incomingText = messageContainer?.messageBody || 
                           messageContainer?.body || 
                           messageContainer?.message?.conversation || 
                           messageContainer?.text || "";

        // If data is hidden inside an array structure wrapper, capture the first entry item
        if (Array.isArray(messageContainer) && messageContainer.length > 0) {
            const firstMsg = messageContainer[0];
            rawPhone = firstMsg?.key?.remoteJid || firstMsg?.from || rawPhone;
            incomingText = firstMsg?.messageBody || firstMsg?.message?.conversation || incomingText;
        }

        if (!rawPhone) {
            console.log('🛑 Aborting: Unable to isolate valid recipient phone metadata layout.');
            return;
        }

        // Clean WhatsApp internal instance metadata suffix paths if present (e.g. 234xxx@s.whatsapp.net)
        const senderPhone = rawPhone.includes('@') ? rawPhone.split('@')[0] : rawPhone;
        console.log(`Parsed Targets -> Phone: [${senderPhone}] | Body Text: "${incomingText}"`);

        if (!incomingText || incomingText.trim() === '') {
            console.log('🛑 Aborting: Message string context content is empty.');
            return;
        }

        // Diagnostic bypass test keyword to verify immediate outbound paths instantly
        if (incomingText.toLowerCase().trim() === 'test') {
            console.log('🎯 Diagnostic test command matched! Dispatching echo response card...');
            await sendWhatsAppMessage(senderPhone, 'Hello! Your Render web application and Wasender webhook loop is 100% active. 🚀');
            return;
        }

        // Forward raw chat text to OpenAI GPT parsing pipeline matrices
        console.log('🤖 Invoking OpenAI structured data schema extractor layer...');
        const searchParameters = await extractFlightDetails(incomingText);
        
        if (!searchParameters || !searchParameters.from_city || !searchParameters.to_city) {
            console.log('⚠️ OpenAI returned an incomplete parameter map missing departure/destination values.');
            await sendWhatsAppMessage(senderPhone, "Sorry, I couldn't pick up your flight details. Please mention your origin, destination, and travel date clearly.");
            return;
        }

        // Build mock flight data arrays based on parsed search requirements
        const mockItineraries = [
            { airline: 'Air Peace', route: `${searchParameters.from_city.toUpperCase()} ➔ ${searchParameters.to_city.toUpperCase()} (Direct)`, price: '₦450,000' },
            { airline: 'Qatar Airways', route: `${searchParameters.from_city.toUpperCase()} ➔ ${searchParameters.to_city.toUpperCase()} (1 Stop)`, price: '₦1,250,000' }
        ];

        let responseTemplate = `✈️ *Available Flights on Wakkago.com*\n`;
        responseTemplate += `📅 Travel Date: *${searchParameters.departure_date}*\n\n`;

        mockItineraries.forEach((flight, index) => {
            responseTemplate += `*${index + 1}. ${flight.airline}*\n`;
            responseTemplate += `🔄 Route: ${flight.route}\n`;
            responseTemplate += `💰 Price: ${flight.price}\n`;
            responseTemplate += `────────────────────\n`;
        });

        responseTemplate += `To finalize your booking, please respond with your option choice number!`;

        await sendWhatsAppMessage(senderPhone, responseTemplate);

    } catch (error) {
        console.error('💥 Webhook runtime crash safely caught:', error.message);
    }
});

// OpenAI Parameter Extractor Matrix
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
                            from_city: { type: "string", description: "Departure origin city name or IATA code" },
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
        console.error('❌ OpenAI Parsing Layer Interruption Exception:', error.message);
        return null;
    }
}

// Global Outbound Message Dispatch Controller
async function sendWhatsAppMessage(recipient, messageBody) {
    try {
        const payload = {
            to: recipient.trim(),
            text: messageBody
        };

        // Explicitly include device parameters if provided inside environment setups
        if (WASENDER_DEVICE_ID) {
            payload.device_id = WASENDER_DEVICE_ID;
        }

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
