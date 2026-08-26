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

        // BROAD SCAN FOR ANY INCOMING AUDIO URL KEYS
        if (payload.data) {
            phone = payload.data.senderId || payload.data.from || "";
            
            if (payload.data.message) {
                const msgObj = payload.data.message;
                // Capture any possible variations of the audio field name
                const audioBlock = msgObj.audioMessage || msgObj.audiomessage || msgObj.audio || msgObj.voice || null;
                if (audioBlock && audioBlock.url) {
                    audioUrl = audioBlock.url;
                } else {
                    msgText = msgObj.conversation || msgObj.text || msgObj.caption || "";
                }
            }
            msgText = msgText || payload.data.messageBody || payload.data.msg || payload.data.body || "";
        }

        // Top-level layout parameter fallbacks
        const topAudio = payload.audioMessage || payload.audiomessage || payload.audio || null;
        if (topAudio && topAudio.url) audioUrl = topAudio.url;
        
        msgText = msgText || payload.conversation || payload.messageBody || payload.text || payload.body || "";
        phone = phone || payload.chatId || payload.phone || payload.from || "";

        console.log(`Extraction Phase -> Found Audio URL: "${audioUrl}" | Found Text: "${msgText}"`);

        // 3. IF VOICE MESSAGE IS DETECTED: DOWNLOAD AND TRANSCRIBE VIA WHISPER
        if (audioUrl) {
            try {
                console.log("Downloading audio file for transcription from URL:", audioUrl);
                const localAudioPath = path.join('/tmp', `voice-${Date.now()}.ogg`);
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

                console.log("Audio download finished cleanly. Transcribing via OpenAI Whisper API...");
                const transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(localAudioPath),
                    model: "whisper-1",
                });

                msgText = transcription.text;
                console.log(`Whisper Transcribed Text: "${msgText}"`);

                // Clean up local temp file path
                if (fs.existsSync(localAudioPath)) fs.unlinkSync(localAudioPath);

            } catch (whisperErr) {
                console.error("Audio Transcription module failed:", whisperErr.message);
            }
        }

        console.log(`Final Processed Message Text: "${msgText}" from Sender: ${phone}`);

        if (!msgText) {
            console.log("No text content could be processed. Skipping OpenAI generation.");
            return;
        }

        // 4. TRIGGER OPENAI GPT TO PARSE FLIGHT CRITERIA
        console.log("Forwarding parameters to OpenAI GPT Engine...");
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
