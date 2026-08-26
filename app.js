import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Render automatically provisions the correct port
const PORT = process.env.PORT || 10000;

// Environment credentials loaded via Render Dashboard
const WASENDER_TOKEN = process.env.WASENDER_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WASENDER_API_URL = 'https://wasender.com'; 

// 1. Browser Health Check
app.get('/', (req, res) => {
    res.status(200).send('🚀 Wakkago Core Engine is live on Render!');
});

// 2. Incoming WASender Webhook Endpoint
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        console.log('--- NEW LIVE WEBHOOK RECEIVED ---');
        console.log('Raw Payload Data:', JSON.stringify(req.body, null, 2));

        // Safely capture sender phone and text across varying WASender webhook schemas
        const senderPhone = req.body?.from || req.body?.phone || req.body?.data?.from;
        const incomingText = req.body?.body || req.body?.message || req.body?.data?.message;

        if (!incomingText || !senderPhone) {
            console.log('Empty text payload or missing sender identification.');
            return res.sendStatus(200);
        }

        console.log(`Processing inbound chat from: ${senderPhone} | Message: "${incomingText}"`);

        // Quick verification command to ensure the end-to-end webhook path functions
        if (incomingText.toLowerCase().trim() === 'test') {
            await sendWhatsAppMessage(senderPhone, 'Hello! Your Render app and WASender webhook connection is 100% active. 🚀');
            return res.sendStatus(200);
        }

        // Send human text to OpenAI to pull structured parameters
        const searchParameters = await extractFlightDetails(incomingText);
        
        if (!searchParameters || !searchParameters.from_city || !searchParameters.to_city) {
            await sendWhatsAppMessage(senderPhone, "Sorry, I couldn't pick up your flight details. Please mention your origin, destination, and travel date.");
            return res.sendStatus(200);
        }

        // Present parsed criteria to customer before integrating live wakkago.com search engine
        let confirmationMessage = `✈️ *Flight Search Received!*\n\n`;
        confirmationMessage += `🛫 From: ${searchParameters.from_city}\n`;
        confirmationMessage += `🛬 To: ${searchParameters.to_city}\n`;
        confirmationMessage += `📅 Date: ${searchParameters.departure_date}\n\n`;
        confirmationMessage += `_Next step: Connecting live database to pull real-time flight options._`;

        await sendWhatsAppMessage(senderPhone, confirmationMessage);
        res.sendStatus(200);

    } catch (error) {
        console.error('System Webhook Error:', error.message);
        res.sendStatus(200); // Prevent webhook loop retries from WASender on exception
    }
});

// OpenAI API Structural Parser Task
async function extractFlightDetails(userMessage) {
    try {
        const response = await axios.post('https://openai.com', {
            model: 'gpt-4o-mini', 
            messages: [
                {
                    role: 'system',
                    content: 'Extract flight search parameters from the user text. Convert dates to YYYY-MM-DD format. Respond strictly with JSON format.'
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
                            from_city: { type: "string", description: "Departure city name or airport code" },
                            to_city: { type: "string", description: "Destination city name or airport code" },
                            departure_date: { type: "string", description: "Target travel date" }
                        },
                        required: ["from_city", "to_city", "departure_date"],
                        additionalProperties: false
                    }
                }
            }
        }, {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
        });

        return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
        console.error('OpenAI Parsing Interruption:', error.message);
        return null;
    }
}

// Outbound Message Execution Handler
async function sendWhatsAppMessage(recipient, messageBody) {
    try {
        await axios.post(WASENDER_API_URL, {
            phone: recipient,
            body: messageBody
        }, {
            headers: { 'Authorization': `Bearer ${WASENDER_TOKEN}` }
        });
        console.log(`Outbound response successfully delivered to ${recipient}`);
    } catch (error) {
        console.error('Outbound Delivery Error:', error.response?.data || error.message);
    }
}

app.listen(PORT, () => console.log(`Server executing seamlessly on port ${PORT}`));
