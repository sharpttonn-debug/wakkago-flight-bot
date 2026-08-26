require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

// Secure initialization of the OpenAI Client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// FIX: Bulletproof text scanner that handles objects, arrays, and fallbacks cleanly
function findMessageText(obj) {
    if (!obj || typeof obj !== 'object') return "";
    
    // If it's an array (like message: [ ... ] in your logs), scan the first item
    if (Array.isArray(obj)) {
        for (let item of obj) {
            let res = findMessageText(item);
            if (res) return res;
        }
    }

    // Direct key extractions
    let text = obj.messageBody || obj.conversation || obj.text || obj.body || obj.msg || "";
    if (text) return text;

    // Deep scanning nested objects
    for (let key in obj) {
        if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
            let result = findMessageText(obj[key]);
            if (result) return result;
        }
    }
    return "";
}

function findAudioUrl(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
        for (let item of obj) {
            let res = findAudioUrl(item);
            if (res) return res;
        }
    }
    if (obj.url && (obj.mimetype?.includes('audio') || obj.waveform || obj.seconds)) {
        return obj.url;
    }
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            let result = findAudioUrl(obj[key]);
            if (result) return result;
        }
    }
    return null;
}

app.all(['/', '/flights'], async (req, res) => {
    console.log("=== INCOMING WHATSAPP BOT PAYLOAD ===");
    console.log(JSON.stringify(req.body, null, 2));

    if (req.method === 'GET') {
        return res.send('Flight Search Bot Engine is running perfectly online!');
    }

    // Instantly respond with a 200 OK status code to keep the gateway healthy
    res.status(200).json({ status: 'received' });

    try {
        const payload = req.body;
        
        // 1. EXTRACT DATA VALUES USING NEW ARRAY-SAFE SCANNERS
        let msgText = findMessageText(payload);
        let audioUrl = findAudioUrl(payload);
        let phone = payload.data?.senderId || payload.data?.from || payload.chatId || "Unknown";

        console.log(`Smart Scanner -> Found Audio Link: "${audioUrl}" | Found Text String: "${msgText}"`);

        console.log(`Processing Text Context: "${msgText}" for Customer: ${phone}`);

        if (!msgText) {
            console.log("Empty textual string. Skipping OpenAI integration pipeline.");
            return;
        }

        console.log("Forwarding parameters to OpenAI GPT Engine...");
        const aiRes = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: "Extract parameters from text. Output JSON with keys: origin, destination, date. Use null if missing." 
                },
                { role: "user", content: msgText }
            ],
            response_format: { type: "json_object" }
        });

        console.log("🎉 SUCCESS! AI Extraction Results:", aiRes.choices.message.content);

    } catch (error) {
        console.error("CRITICAL EXCEPTION RUNNING ENDPOINT LOOP:", error.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Wakkago Flight Bot Server listening perfectly on port ${PORT}`);
});
