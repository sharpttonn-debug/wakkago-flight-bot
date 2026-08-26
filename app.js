require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

// Initialize OpenAI configuration safely
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "DUMMY_KEY" });

// Universal route handling both root '/' and '/flights' for WasenderAPI webhooks
app.all(['/', '/flights'], async (req, res) => {
    // 1. PRINT RAW INCOMING DATA TO RENDER LOGS INSTANTLY
    console.log("=== INCOMING WHATSAPP BOT PAYLOAD ===");
    console.log(JSON.stringify(req.body, null, 2));

    // Handle initial browser tests or heartbeat pings
    if (req.method === 'GET') {
        return res.send('Flight Search Bot Engine is running perfectly online!');
    }

    // 2. ACKNOWLEDGE RECEIPT IMMEDIATELY TO WASENDERAPI TO PREVENT TIMEOUTS
    res.status(200).json({ status: 'received' });

    try {
        const payload = req.body;
        let msgText = "";
        let phone = "";
        let audioUrl = "";

        // Extracting data elements based on Wasender architecture
        if (payload.data) {
            phone = payload.data.senderId || payload.data.from || "";
            if (payload.data.message) {
                // Check if it's a voice message or audio recording
                if (payload.data.message.audioMessage) {
                    audioUrl = payload.data.message.audioMessage.url || "";
                    console.log("Voice message detected! URL:", audioUrl);
                } else {
                    msgText = payload.data.message.conversation || payload.data.message.text || "";
                }
            }
            msgText = msgText || payload.data.messageBody || payload.data.msg || payload.data.body || "";
        }

        // Top-level fallbacks
        msgText = msgText || payload.conversation || payload.messageBody || payload.text || payload.body || "";
        phone = phone || payload.chatId || payload.phone || payload.from || "";

        // 3. IF VOICE MESSAGE: DOWNLOAD AND TRANSCRIBE VIA OPENAI WHISPER
        if (audioUrl) {
            try {
                console.log("Downloading audio file for transcription...");
                const localAudioPath = path.join('/tmp', 'voice.ogg');
                const writer = fs.createWriteStream(localAudioPath);

                const response = await axios({
                    url: audioUrl,
                    method: 'GET',
                    responseType: 'stream'
                });

                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                console.log("Audio download finished. Transcribing with Whisper API...");
                const transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(localAudioPath),
                    model: "whisper-1",
                });

                msgText = transcription.text;
                console.log(`Whisper Transcribed Text: "${msgText}"`);

            } catch (whisperErr) {
                console.error("Audio Transcription failed:", whisperErr.message);
            }
        }

        console.log(`Final Processed Message Text: "${msgText}" from Sender: ${phone}`);

        if (!msgText) {
            console.log("No text or audio content found in payload. Skipping OpenAI generation.");
            return;
        }

        // 4. TRIGGER OPENAI GPT TO PARSE FLIGHT CRITERIA
        console.log("Forwarding text content to OpenAI GPT...");
        try {
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
            }, { timeout: 10000 });

            console.log("AI Extraction Results:", aiRes.choices.message.content);
            
            // --- YOUR BACKEND API OR FLIGHT BOOKING LOGIC GOES HERE ---

        } catch (aiError) {
            console.error("GPT Connection Error (Check your API Key settings in Render):", aiError.message);
        }

    } catch (error) {
        console.error("CRITICAL ERROR IN WEBHOOK LOOP:", error.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Wakkago Flight Bot Server listening perfectly on port ${PORT}`);
});
