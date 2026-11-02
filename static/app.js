
// const mic = document.getElementById("mic");
// const statusText = document.getElementById("status");
// const messages = document.getElementById("messages");

// let recorder = null;
// let stream = null;
// let chunks = [];
// let busy = false;
// let startedAt = 0;
// let maxTimer = null;

// function setStatus(text) {
//   statusText.textContent = text;
// }

// function addMessage(text, role) {
//   const div = document.createElement("div");
//   div.className = `message ${role}`;
//   div.textContent = text;
//   messages.appendChild(div);
//   messages.scrollTop = messages.scrollHeight;
// }

// function releaseMic() {
//   if (maxTimer) clearTimeout(maxTimer);
//   maxTimer = null;
//   if (stream) stream.getTracks().forEach(track => track.stop());
//   stream = null;
//   recorder = null;
//   mic.disabled = false;
//   mic.classList.remove("recording");
//   mic.textContent = "🎙️";
// }

// async function sendAudio(blob) {
//   if (!blob.size) {
//     setStatus("Audio record nahi hui. Dobara try karein.");
//     releaseMic();
//     busy = false;
//     return;
//   }

//   busy = true;
//   mic.disabled = true;
//   setStatus("Aapki baat samajh raha hoon...");

//   try {
//     const form = new FormData();
//     form.append("audio", blob, "recording.webm");

//     const response = await fetch("/api/voice", {
//       method: "POST",
//       body: form
//     });

//     const data = await response.json();
//     if (!response.ok) {
//       throw new Error(data.detail || "Voice request fail hui.");
//     }

//     if (data.transcript) addMessage(data.transcript, "user");
//     if (data.reply) addMessage(data.reply, "assistant");

//     if (data.audio_base64) {
//       setStatus("Assistant bol raha hai...");
//       const audio = new Audio(
//         `data:${data.audio_mime_type || "audio/mpeg"};base64,${data.audio_base64}`
//       );
//       await audio.play();
//       await new Promise(resolve => {
//         audio.onended = resolve;
//         audio.onerror = resolve;
//       });
//     }

//     setStatus("Taiyaar! Agli baat ke liye mic dabayein.");
//   } catch (error) {
//     console.error(error);
//     setStatus(`Error: ${error.message}`);
//   } finally {
//     releaseMic();
//     busy = false;
//   }
// }

// function stopRecording() {
//   if (!recorder || recorder.state !== "recording") return;

//   if (Date.now() - startedAt < 800) {
//     setStatus("Thoda aur boliye, phir mic dabayein.");
//     return;
//   }

//   if (maxTimer) clearTimeout(maxTimer);
//   maxTimer = null;
//   recorder.stop();
//   setStatus("Recording complete ho rahi hai...");
// }

// mic.addEventListener("click", async () => {
//   if (busy) return;

//   if (recorder?.state === "recording") {
//     stopRecording();
//     return;
//   }

//   try {
//     if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
//       throw new Error("Is browser mein microphone recording supported nahi hai.");
//     }

//     stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//     chunks = [];

//     const supportedType = [
//       "audio/webm;codecs=opus",
//       "audio/webm",
//       "audio/mp4"
//     ].find(type => MediaRecorder.isTypeSupported(type));

//     recorder = supportedType
//       ? new MediaRecorder(stream, { mimeType: supportedType })
//       : new MediaRecorder(stream);

//     recorder.ondataavailable = event => {
//       if (event.data.size > 0) chunks.push(event.data);
//     };

//     recorder.onerror = () => {
//       setStatus("Recording mein problem hui. Dobara try karein.");
//       releaseMic();
//     };

//     recorder.onstop = () => {
//       const blob = new Blob(chunks, {
//         type: recorder?.mimeType || "audio/webm"
//       });
//       releaseMic();
//       sendAudio(blob);
//     };

//     recorder.start();
//     startedAt = Date.now();
//     mic.classList.add("recording");
//     mic.textContent = "⏹️";
//     setStatus("Sun raha hoon... bolne ke baad mic dobara dabayein.");

//     maxTimer = setTimeout(() => {
//       if (recorder?.state === "recording") stopRecording();
//     }, 15000);

//   } catch (error) {
//     console.error(error);
//     releaseMic();
//     setStatus(`Mic access nahi mila: ${error.message}`);
//   }
// });



const mic = document.getElementById("mic");
const statusText = document.getElementById("status");
const messages = document.getElementById("messages");

let recorder = null;
let stream = null;
let chunks = [];
let busy = false;
let startedAt = 0;
let maxTimer = null;

// Status update
function setStatus(text) {
  statusText.textContent = text;
  console.log("[STATUS]", text);
}

// Add chat message
function addMessage(text, role) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// Release microphone
function releaseMic() {
  if (maxTimer) clearTimeout(maxTimer);
  maxTimer = null;

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  stream = null;
  recorder = null;
  mic.disabled = false;
  mic.classList.remove("recording");
  mic.textContent = "🎙️";
}

// Play generated audio
async function playAssistantAudio(data) {
  console.log("[AUDIO] Checking audio response");

  if (!data.audio_base64) {
    throw new Error("API response mein audio_base64 missing hai.");
  }

  console.log("[AUDIO] Base64 length:", data.audio_base64.length);
  console.log("[AUDIO] MIME type:", data.audio_mime_type);

  const binary = atob(data.audio_base64);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: data.audio_mime_type || "audio/mpeg"
  });

  console.log("[AUDIO] Blob size:", blob.size);

  if (blob.size === 0) {
    throw new Error("Generated audio empty hai.");
  }

  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);

  audio.controls = true;
  audio.preload = "auto";

  messages.appendChild(audio);
  messages.scrollTop = messages.scrollHeight;

  audio.onended = () => {
    console.log("[AUDIO] Playback completed");
    setStatus("Taiyaar! Agli baat ke liye mic dabayein.");
    URL.revokeObjectURL(audioUrl);
  };

  audio.onerror = () => {
    console.error("[AUDIO] Playback failed:", audio.error);
    setStatus("Audio play nahi hui. Console check karein.");
    URL.revokeObjectURL(audioUrl);
  };

  setStatus("Assistant bol raha hai...");

  try {
    await audio.play();
    console.log("[AUDIO] Playback started");
  } catch (error) {
    console.error("[AUDIO] Autoplay failed:", error);
    setStatus("Play button dabakar awaaz sun sakte hain.");
  }
}

// Send recorded audio to backend
async function sendAudio(blob) {
  if (!blob.size) {
    setStatus("Audio record nahi hui. Dobara try karein.");
    releaseMic();
    busy = false;
    return;
  }

  busy = true;
  mic.disabled = true;

  setStatus("Aapki baat samajh raha hoon...");

  try {
    console.log("[API] Sending audio:", blob.size);

    const form = new FormData();
    form.append("audio", blob, "recording.webm");

    const response = await fetch("/api/voice", {
      method: "POST",
      body: form
    });

    console.log("[API] HTTP status:", response.status);

    const data = await response.json();

    console.log("[API] Response:", data);

    if (!response.ok) {
      throw new Error(data.detail || "Voice request fail hui.");
    }

    if (data.transcript) {
      addMessage(data.transcript, "user");
    }

    if (data.reply) {
      addMessage(data.reply, "assistant");
    }

    if (data.audio_base64) {
      await playAssistantAudio(data);
    } else {
      console.error("[API] Audio missing:", data);
      setStatus("Reply mil gaya, lekin audio response missing hai.");
    }

  } catch (error) {
    console.error("[VOICE ERROR]", error);
    setStatus(`Error: ${error.message}`);
  } finally {
    releaseMic();
    busy = false;
  }
}

// Stop recording
function stopRecording() {
  if (!recorder || recorder.state !== "recording") return;

  if (Date.now() - startedAt < 800) {
    setStatus("Thoda aur boliye, phir mic dabayein.");
    return;
  }

  if (maxTimer) clearTimeout(maxTimer);
  maxTimer = null;

  recorder.stop();
  setStatus("Recording complete ho rahi hai...");
}

// Microphone button
mic.addEventListener("click", async () => {
  if (busy) return;

  if (recorder?.state === "recording") {
    stopRecording();
    return;
  }

  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error("Browser recording support nahi karta.");
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    chunks = [];

    const supportedType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4"
    ].find(type => MediaRecorder.isTypeSupported(type));

    recorder = supportedType
      ? new MediaRecorder(stream, { mimeType: supportedType })
      : new MediaRecorder(stream);

    console.log("[MIC] Recording format:", recorder.mimeType);

    recorder.ondataavailable = event => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

<<<<<<< HEAD

    recorder.onerror = () => {
        setStatus("Recording mein problem hui. Dobara try karein.");
        releaseMic();
        busy = false;
      };
=======
    recorder.onerror = event => {
      console.error("[MIC ERROR]", event);
      setStatus("Recording mein problem hui.");
      releaseMic();
    };
>>>>>>> e869d22 (update_files)

    recorder.onstop = () => {
      const blob = new Blob(chunks, {
        type: recorder.mimeType || "audio/webm"
      });

      console.log("[MIC] Recording size:", blob.size);

      releaseMic();
      sendAudio(blob);
    };

    recorder.start();

    startedAt = Date.now();

    mic.classList.add("recording");
    mic.textContent = "⏹️";

    setStatus("Sun raha hoon... bolne ke baad mic dobara dabayein.");

    maxTimer = setTimeout(() => {
      if (recorder?.state === "recording") {
        stopRecording();
      }
    }, 15000);

  } catch (error) {
    console.error("[MIC ERROR]", error);
    releaseMic();
    setStatus(`Mic access nahi mila: ${error.message}`);
  }
});
