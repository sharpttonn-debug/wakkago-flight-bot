require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Array pattern handles standard routing calls effortlessly
app.all(['/', '/flights'], async (req, res) => {
    if (req.method === 'GET') {
        return res.send('Flight Search Bot Engine is running perfectly online!');
    }
    
    res.sendStatus(200);

    try {
        const payload = req.body;
        const msgText = payload.message?.text || payload.text || payload.body || payload.msg || (payload.data && payload.data.body);
        const phone = payload.from || payload.phone || payload.chatId || (payload.data && payload.data.from);

        if (!msgText || !phone) return;

        const aiRes = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Extract parameters from text. Output JSON with keys: origin, destination, date. Use null if missing." },
                { role: "user", content: msgText }
            ],
            response_format: { type: "json_object" }
        });

        const params = JSON.parse(aiRes.choices.message.content);

        if (!params.origin || !params.destination || !params.date) {
            await sendMsg(phone, "👋 Hello! Please provide your Departure City, Destination, and Travel Date (e.g., Abuja to London on 21 September).");
            return;
        }

        const flights = await searchDB(params.origin, params.destination, params.date);
        let reply = `✈️ *Available Flights!*\n📍 Route: ${params.origin.toUpperCase()} -> ${params.destination.toUpperCase()}\n📅 Date: ${params.date}\n\n`;

        if (flights.length === 0) {
            reply += "❌ No flights found on this date.";
        } else {
            flights.forEach((f, i) => {
                reply += `${i + 1}️⃣ *${f.airline}*\n• Dep: ${f.dep} | Arr: ${f.arr}\n• Price: ${f.price}\n• Book: ${f.url}\n\n`;
            });
        }

        await sendMsg(phone, reply);
    } catch (err) {
        console.error("Internal loop error log:", err.message);
    }
});

async function sendMsg(to, text) {
    const cleanTo = String(to).split('@')[0];
    try {
        await axios.post('https://wasenderapi.com', {
            device_id: process.env.WASENDER_DEVICE_ID,
            to: cleanTo,
            type: 'text',
            text: text
        }, {
            headers: { 'Authorization': `Bearer ${process.env.WASENDER_API_KEY}` }
        });
    } catch (e) {
        console.error("WASender error:", e.response?.data || e.message);
    }
}

async function searchDB(from, to, date) {
    return [
        { airline: "British Airways", dep: "08:00 AM", arr: "02:30 PM", price: "₦1,200,000", url: "https://wakkago.com" },
        { airline: "Qatar Airways", dep: "11:30 AM", arr: "09:15 PM", price: "₦950,000", url: "https://wakkago.com" }
    ];
}

const PORT = process.env.PORT || 3000;
app.listen(PORT);

