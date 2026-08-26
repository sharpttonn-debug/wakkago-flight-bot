import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Render automatically provisions the correct port
const PORT = process.env.PORT || 10000;
const MY_SERVER_URL = 'https://wakkago-flight-bot.onrender.com';

// Security and account credentials loaded directly from your Render panel
const WASENDER_TOKEN = process.env.WASENDER_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WASENDER_DEVICE_ID = process.env.WASENDER_DEVICE_ID;

// Target API endpoint for your specific Wasender platform version
const WASENDER_API_URL = 'https://wasenderapi.com'; 

// 1. Browser Status Check
app.get('/', (req, res) => {
    res.status(200).send(`🚀 Wakkago Automation Pipeline is fully online and ready at ${MY_SERVER_URL}!`);
});

// 2. Incoming WASender Webhook Endpoint
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        console.log('=== 🔔 NEW LIVE WEBHOOK PAYLOAD INBOUND ===');
        console.log('Incoming JSON Structure:', JSON.stringify(req.body, null, 2));

        // Dynamically unpack varying nested object variants from Wasender payload
        const messagePayload = req.body?.data || req.body;
        
        const senderPhone = messagePayload?.from || messagePayload?.phone || messagePayload?.sender;
        const incomingText = messagePayload?.body || messagePayload?.message || messagePayload?.text;

        console.log(`Parsed Data Extracted -> Phone: [${senderPhone}] | Message Text: "${incomingText}"`);

        // Acknowledge receipt back to Wasender immediately to prevent message delivery timeouts
        res.status(200).send({ status: 'received', listener: `${MY_SERVER_URL}/webhook/whatsapp` });

        if (!incomingText || !senderPhone) {
            console.log('🛑 Aborting: Message text content or sender tracking data is completely empty.');
            return;
        }

        // Direct bypass keyword rule to test end-to-end messaging pipeline instantly
        if (incomingText.toLowerCase().trim() === 'test') {
            console.log('🎯 "test" match triggered! Dispatching immediate echo response...');
            await sendWhatsAppMessage(senderPhone, 'Hello! Your Render web application and Wasender webhook loop is 100% active. 🚀');
            return;
        }

        // Pass natural expressions to OpenAI to isolate search variables into clean JSON fields
        console.log('🤖 Forwarding data payload to OpenAI parsing layer...');
        const searchParameters = await extractFlightDetails(incomingText);
        
        if (!searchParameters || !searchParameters.from_city || !searchParameters.to_city) {
            console.log('⚠️ OpenAI failed to identify clean destination parameters.');
            await sendWhatsAppMessage(senderPhone, "Sorry, I couldn't pick up your flight details. Please mention your origin, destination, and travel date clearly.");
            return;
        }

        // Return a beautiful confirmation template detailing what the bot parsed
        let confirmationCard = `✈️ *Wakkago Flight Engine parsing test:*\n\n`;
        confirmationCard += `🛫 From: *${searchParameters.from_city}*\n`;
        confirmationCard += `🛬 To: *${searchParameters.to_city}*\n`;
        confirmationCard += `📅 Date: *${searchParameters.departure_date}*\n\n`;
        confirmationCard += `_The AI connection is working! Next we will plug in your live database to pull real itineraries._`;

        await sendWhatsAppMessage(senderPhone, confirmationCard);

    } catch (error) {
        console.error('💥 Webhook Global Error Exception:', error.message);
        if (!res.headersSent) {
            res.sendStatus(200); // Fail gracefully to keep webhook streaming loops clear
        }
    }
});

// OpenAI JSON Layout Schema Parser Model
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
                            from_city: { type: "string", description: "Departure city name or IATA airport identity code" },
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
        console.error('❌ OpenAI Parameter parsing exception:', error.message);
        return null;
    }
}

// Global Outbound Wasender JSON Payload Disptacher Block
async function sendWhatsAppMessage(recipient, messageBody) {
    try {
        const payload = {
            to: recipient,
            type: 'text',
            text: messageBody
        };

        // Explicitly include device contexts if required by your Wasender profile variables
        if (WASENDER_DEVICE_ID) {
            payload.device_id = WASENDER_DEVICE_ID;
        }

        console.log(`📤 Sending payload to Wasender:`, JSON.stringify(payload));

        const response = await axios.post(WASENDER_API_URL, payload, {
            headers: { 
                'Authorization': `Bearer ${WASENDER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ Message response successfully completed:`, response.data);
    } catch (error) {
        console.error('❌ Outbound Network Error Response:', error.response?.data || error.message);
    }
}

app.listen(PORT, () => console.log(`🚀 Automated testing system executing flawlessly on internal port ${PORT}`));
