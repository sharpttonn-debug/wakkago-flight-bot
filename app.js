require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "DUMMY_KEY" });

// Helper function to deeply scan the payload for any audio file URL link
function findAudioUrl(obj) {
    if (!obj || typeof obj !== 'object') return null;
    
    // If we find an object containing both an active url and mimetype audio, grab it!
    if (obj.url && (obj.mimetype?.includes('audio') || obj.waveform || obj.seconds)) {
        return obj.url;
    }
    
    // Or check common key variations directly
    if (obj.audioUrl || obj.audio_url || obj.voiceUrl) {
        return obj.audioUrl || obj.audio_url || obj.voiceUrl;
    }

    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            let result = findAudioUrl(obj[key]);
            if (result) return result;
        }
    }
    return null;
}

// Deep text scanner fallback
function findMessageText(obj) {
    if (!obj || typeof obj !== 'object') return "";
    return obj.conversation || obj.text || obj.messageBody || obj.body || obj.msg || "";
}

app.all(['/', '/flights'], async (req, res) => {
    console.log("=== INCOMING WHATSAPP BOT PAYLOAD ===");
    console.log(JSON.stringify(req.body, null, 2));

    if (req.method === 'GET') {
        return res.send('Flight Search Bot Engine is running perfectly online!');
    }

    res.status(200).json({ status: 'received' });

    try {
        const payload = req.body;
        
        // 1. DYNAMICALLY SCAN AND EXTRACT MEDIA LINKS OR TEXT STRINGS
        let audioUrl = findAudioUrl(payload);
        let msgText = findMessageText(payload.data?.message || payload.data || payload);
        let phone = payload.data?.senderId || payload.data?.from || payload.chatId || "";

        console.log(`Smart Scan Results -> Detected Audio URL: "${audioUrl}" | Detected Text: "${msgText}"`);

        // 2. PROCESS VOICE TRANSLCRIPTION IF AUDIO EXISTS
        if (audioUrl) {
            try {
                console.log("Downloading voice file from URL:", audioUrl);
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

                console.log("Audio file saved. Transcribing via OpenAI Whisper...");
                const transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(localAudioPath),
                    model: "whisper-1",
                });

                msgText = transcription.text;
                console.log(`Whisper Transcribed Text Result: "${msgText}"`);

                if (fs.existsSync(localAudioPath)) fs.unlinkSync(localAudioPath);

            } catch (whisperErr) {
                console.error("Whisper audio module error:", whisperErr.message);
            }
        }

        console.log(`Final Text to process: "${msgText}" from User: ${phone}`);

        if (!msgText) {
            console.log("No valid content found to parse. Skipping OpenAI GPT generation.");
            return;
        }

        // 3. RUN THE GPT FLIGHT EXTRACTOR
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

            console.log("🎉 SUCCESS! AI Extraction Results:", aiRes.choices.message.content);

        } catch (aiError) {
            console.error("GPT Connection Error (Verify your OPENAI_API_KEY environment variable in Render Settings):", aiError.message);
        }

    } catch (error) {
        console.error("CRITICAL EXCEPTION IN LOOP:", error.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Wakkago Flight Bot Server listening perfectly on port ${PORT}`);
});
