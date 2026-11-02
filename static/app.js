
"use strict";

/*
|--------------------------------------------------------------------------
| HOTEL BOOKING VOICE ASSISTANT - FRONTEND
|--------------------------------------------------------------------------
| Features:
| 1. Microphone permission handling
| 2. Audio recording using MediaRecorder
| 3. Send audio to FastAPI /api/voice
| 4. Display user transcript and assistant reply
| 5. Play ElevenLabs generated audio
| 6. Debugging through browser console
|--------------------------------------------------------------------------
*/

// ==============================
// 1. DOM ELEMENTS
// ==============================

const mic = document.getElementById("mic");
const statusText = document.getElementById("status");
const messages = document.getElementById("messages");

// Check HTML elements
if (!mic || !statusText || !messages) {
    console.error("[INIT ERROR] Required HTML elements not found.");
    throw new Error("Mic, status or messages element missing.");
}

console.log("[INIT] Voice assistant JavaScript loaded successfully.");


// ==============================
// 2. GLOBAL VARIABLES
// ==============================

let recorder = null;
let stream = null;
let chunks = [];

let busy = false;
let startedAt = 0;

let maxTimer = null;

// ==============================
// 3. STATUS HANDLER
// ==============================

function setStatus(message) {
    statusText.textContent = message;
    console.log("[STATUS]", message);
}


// ==============================
// 4. CHAT MESSAGE HANDLER
// ==============================

function addMessage(text, role) {

    const div = document.createElement("div");

    div.className = `message ${role}`;
    div.textContent = text;

    messages.appendChild(div);

    // Automatically scroll to latest message
    messages.scrollTop = messages.scrollHeight;

    console.log(`[CHAT] ${role}:`, text);
}


// ==============================
// 5. RELEASE MICROPHONE
// ==============================

function releaseMic() {

    console.log("[MIC] Releasing microphone resources.");

    // Clear recording timer
    if (maxTimer) {
        clearTimeout(maxTimer);
        maxTimer = null;
    }

    // Stop all microphone tracks
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop();
        });
    }

    stream = null;
    recorder = null;

    // Reset button
    mic.disabled = false;
    mic.classList.remove("recording");
    mic.textContent = "🎙️";
}


// ==============================
// 6. PLAY ASSISTANT AUDIO
// ==============================

async function playAssistantAudio(data) {

    console.log("[AUDIO] Starting audio playback.");

    if (!data.audio_base64) {
        throw new Error("API response mein audio_base64 missing hai.");
    }

    // Decode Base64 audio
    const binary = atob(data.audio_base64);

    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    // Create audio Blob
    const blob = new Blob([bytes], {
        type: data.audio_mime_type || "audio/mpeg"
    });

    if (blob.size === 0) {
        throw new Error("Generated audio empty hai.");
    }

    console.log("[AUDIO] Blob size:", blob.size);

    // Create temporary audio URL
    const audioUrl = URL.createObjectURL(blob);

    const audio = new Audio(audioUrl);

    audio.controls = false;
    audio.preload = "auto";

    // Add player to chat
    messages.appendChild(audio);

    messages.scrollTop = messages.scrollHeight;

    // Playback completed
    audio.onended = () => {

        console.log("[AUDIO] Playback completed.");

        setStatus("Taiyaar! Agli baat ke liye mic dabayein.");

        URL.revokeObjectURL(audioUrl);
    };

    // Playback error
    audio.onerror = () => {

        console.error("[AUDIO ERROR]", audio.error);

        setStatus("Audio play nahi hui. Player se manually try karein.");

        URL.revokeObjectURL(audioUrl);
    };

    setStatus("Assistant bol raha hai...");

    try {

        // Start playback
        await audio.play();

        console.log("[AUDIO] Playback started.");

    } catch (error) {

        // Browser may block automatic playback
        console.error("[AUDIO AUTOPLAY ERROR]", error);

        setStatus("Audio player par Play button dabayein.");
    }
}


// ==============================
// 7. SEND AUDIO TO FASTAPI
// ==============================

async function sendAudio(blob) {

    if (!blob || blob.size === 0) {

        setStatus("Audio record nahi hui. Dobara try karein.");

        releaseMic();

        busy = false;

        return;
    }

    busy = true;
    mic.disabled = true;

    setStatus("Aapki baat samajh raha hoon...");

    try {

        console.log("[API] Recorded audio size:", blob.size);
        console.log("[API] Audio MIME type:", blob.type);

        // Prepare multipart form data
        const form = new FormData();

        form.append("audio", blob, "recording.webm");

        // Send request to FastAPI
        const response = await fetch("/api/voice", {
            method: "POST",
            body: form
        });

        console.log("[API] HTTP status:", response.status);

        // Read raw response as text first
        const responseText = await response.text();

        console.log("[API] Raw response:", responseText);

        // Parse JSON safely
        let data;

        try {
            data = JSON.parse(responseText);
        } catch {
            throw new Error(
                `Server ne valid JSON nahi bheja. HTTP ${response.status}`
            );
        }

        console.log("[API] Parsed response:", data);

        // Handle HTTP errors
        if (!response.ok) {

            throw new Error(
                data.detail || data.error || `HTTP Error ${response.status}`
            );
        }

        // Display recognized speech
        if (data.transcript) {
            addMessage(data.transcript, "user");
        }

        // Display assistant reply
        if (data.reply) {
            addMessage(data.reply, "assistant");
        }

        // Play generated audio
        if (data.audio_base64) {

            await playAssistantAudio(data);

        } else {

            console.warn("[API] Audio response missing:", data);

            setStatus(
                "Reply mil gaya, lekin audio response missing hai."
            );
        }

    } catch (error) {

        console.error("[VOICE API ERROR]", error);

        setStatus(`Error: ${error.message}`);

    } finally {

        // Always release resources
        releaseMic();

        busy = false;

        console.log("[API] Request completed.");
    }
}


// ==============================
// 8. STOP RECORDING
// ==============================

function stopRecording() {

    if (!recorder || recorder.state !== "recording") {
        console.warn("[MIC] Recorder is not recording.");
        return;
    }

    // Prevent very short recordings
    if (Date.now() - startedAt < 800) {

        setStatus("Thoda aur boliye, phir mic dabayein.");

        return;
    }

    console.log("[MIC] Stopping recording.");

    if (maxTimer) {
        clearTimeout(maxTimer);
        maxTimer = null;
    }

    recorder.stop();

    setStatus("Recording complete ho rahi hai...");
}


// ==============================
// 9. START RECORDING
// ==============================

async function startRecording() {

    try {

        console.log("[MIC] Requesting microphone permission.");

        // Browser support check
        if (!navigator.mediaDevices?.getUserMedia) {

            throw new Error(
                "Microphone API unavailable. HTTPS ya localhost required hai."
            );
        }

        if (!window.MediaRecorder) {

            throw new Error(
                "Browser MediaRecorder support nahi karta."
            );
        }

        // Ask for microphone access
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        console.log("[MIC] Microphone permission granted.");

        // Clear old recording chunks
        chunks = [];

        // Select supported audio format
        const supportedTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4"
        ];

        const supportedType = supportedTypes.find(type =>
            MediaRecorder.isTypeSupported(type)
        );

        // Create MediaRecorder
        recorder = supportedType
            ? new MediaRecorder(stream, {
                mimeType: supportedType
            })
            : new MediaRecorder(stream);

        console.log("[MIC] Recording format:", recorder.mimeType);

        // Collect recorded audio chunks
        recorder.ondataavailable = event => {

            if (event.data && event.data.size > 0) {

                chunks.push(event.data);

                console.log(
                    "[MIC] Audio chunk received:",
                    event.data.size
                );
            }
        };

        // Recording error
        recorder.onerror = event => {

            console.error("[MIC ERROR]", event);

            setStatus("Recording mein problem hui. Dobara try karein.");

            releaseMic();

            busy = false;
        };

        // Recording stopped
        recorder.onstop = () => {

            console.log("[MIC] Recording stopped.");

            const audioType =
                recorder?.mimeType || "audio/webm";

            const blob = new Blob(chunks, {
                type: audioType
            });

            console.log("[MIC] Final audio size:", blob.size);

            // Release microphone before API request
            releaseMic();

            // Send recorded audio to backend
            sendAudio(blob);
        };

        // Start recording
        recorder.start();

        startedAt = Date.now();

        mic.classList.add("recording");
        mic.textContent = "⏹️";

        setStatus(
            "Sun raha hoon... bolne ke baad mic dobara dabayein."
        );

        console.log("[MIC] Recording started.");

        // Maximum recording duration = 15 seconds
        maxTimer = setTimeout(() => {

            if (recorder?.state === "recording") {

                console.log("[MIC] Maximum recording time reached.");

                stopRecording();
            }

        }, 15000);

    } catch (error) {

        console.error("[MIC START ERROR]", error);

        releaseMic();

        busy = false;

        setStatus(`Mic access nahi mila: ${error.message}`);
    }
}


// ==============================
// 10. MICROPHONE BUTTON EVENT
// ==============================

mic.addEventListener("click", async () => {

    console.log("[MIC BUTTON] Click detected.");

    if (busy) {

        console.warn("[MIC] Please wait. Request already running.");

        return;
    }

    // If already recording, stop it
    if (recorder?.state === "recording") {

        stopRecording();

        return;
    }

    // Otherwise start recording
    await startRecording();
});


// ==============================
// 11. INITIALIZATION
// ==============================

if (!window.isSecureContext) {

    console.warn(
        "[INIT WARNING] Microphone requires HTTPS or localhost."
    );
}

setStatus("Mic dabakar bolna shuru karein.");

console.log("[INIT] Voice assistant ready.");
