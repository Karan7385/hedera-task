// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { TopicMessageQuery, Client as HClient } from "@hashgraph/sdk";
import { createTopic, submitMessage } from "./hederaClient.js";
import {
  generateSymKey,
  keyToBase64,
  keyFromBase64,
  encryptMessage,
  decryptMessage
} from "./encrypt.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || "4000", 10);
const app = express();
app.use(cors());
app.use(bodyParser.json());

const BASE_DIR = process.cwd();
const TOPIC_FILE = path.join(BASE_DIR, ".topic");
const KEY_FILE = path.join(BASE_DIR, ".symkey");

let topicId = null;
let symKey = null;

/* ---------- Helpers: persistence ---------- */
function saveTopicId(id) {
  fs.writeFileSync(TOPIC_FILE, id, "utf8");
}
function loadTopicId() {
  if (process.env.TOPIC_ID) return process.env.TOPIC_ID;
  if (fs.existsSync(TOPIC_FILE)) return fs.readFileSync(TOPIC_FILE, "utf8").trim();
  return null;
}
function loadOrCreateKey() {
  if (process.env.SYMMETRIC_KEY_B64) {
    symKey = keyFromBase64(process.env.SYMMETRIC_KEY_B64);
    console.log("Loaded symmetric key from env");
    return;
  }
  if (fs.existsSync(KEY_FILE)) {
    const b64 = fs.readFileSync(KEY_FILE, "utf8").trim();
    symKey = keyFromBase64(b64);
    console.log("Loaded symmetric key from file");
  } else {
    symKey = generateSymKey();
    fs.writeFileSync(KEY_FILE, keyToBase64(symKey), "utf8");
    console.log("Generated and saved symmetric key to .symkey");
  }
}

/* ---------- Ensure topic ---------- */
async function ensureTopic() {
  topicId = loadTopicId();
  if (!topicId) {
    console.log("Creating new topic on Hedera testnet...");
    topicId = await createTopic();
    saveTopicId(topicId);
    console.log("Created topic:", topicId);
  } else {
    console.log("Using existing topicId:", topicId);
  }
}

/* ---------- REST API ---------- */
app.get("/api/info", (req, res) => {
  return res.json({ topicId, symKey: keyToBase64(symKey) });
});

app.post("/api/send", async (req, res) => {
  const { message, encrypt } = req.body ?? {};
  if (!message && message !== "") return res.status(400).json({ error: "message required" });

  let payload;
  if (encrypt) {
    payload = encryptMessage(symKey, message);
  } else {
    payload = Buffer.from(String(message), "utf8");
  }

  try {
    const ts = await submitMessage(topicId, payload);
    return res.json({ success: true, timestamp: ts.toISOString() });
  } catch (err) {
    console.error("submitMessage error:", err);
    return res.status(500).json({ error: "submit failed", details: String(err) });
  }
});

/* ---------- Start server & WebSocket ---------- */
const server = app.listen(PORT, async () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  loadOrCreateKey();
  await ensureTopic();
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "info", topicId }));
  console.log("WebSocket client connected");
});

/* ---------- Mirror subscription (single, robust) ---------- */
async function startMirrorSubscription(maxAttempts = 8) {
  // Wait until topicId exists
  while (!topicId) await new Promise((r) => setTimeout(r, 200));

  let attempt = 0;
  const client = HClient.forTestnet(); // local Mirror subscription client (read-only)

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      console.log(`Subscribing to topic ${topicId} (attempt ${attempt})`);
      // subscribe with handler inline
      const subscription = new TopicMessageQuery()
        .setTopicId(topicId)
        .subscribe(
          client,
          null,
          (message) => {
            try {
              // guard: only proceed if message.message exists
              if (!message || !message.message) return;

              const raw = message.message;
              // ensure Buffer
              const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);

              let plaintext;
              try {
                plaintext = decryptMessage(symKey, buf);
              } catch (err) {
                plaintext = buf.toString("utf8");
              }

              // safe seq handling (Long objects)
              let seq = null;
              if (message.sequenceNumber) {
                try {
                  seq = typeof message.sequenceNumber.toNumber === "function"
                    ? message.sequenceNumber.toNumber()
                    : message.sequenceNumber;
                } catch (e) {
                  seq = message.sequenceNumber;
                }
              }

              const payload = {
                type: "message",
                text: plaintext,
                consensusTimestamp: message.consensusTimestamp ? message.consensusTimestamp.toDate().toISOString() : new Date().toISOString(),
                seq
              };

              for (const clientWs of wss.clients) {
                if (clientWs.readyState === 1) clientWs.send(JSON.stringify(payload));
              }
            } catch (err) {
              console.error("Error processing mirror message:", err);
            }
          },
          (err) => {
            console.error("Mirror subscription error (callback):", err);
          }
        );

      console.log(`Mirror subscription successful for topic ${topicId} (attempt ${attempt})`);
      // keep the subscription active (don't unsubscribe in demo). Exit retry loop.
      return subscription;
    } catch (err) {
      // Common case right after topic creation: NOT_FOUND. Log and retry with backoff.
      console.warn(`Error attempting to subscribe to topic: ${topicId} (attempt ${attempt}):`, err?.message ?? err);
      if (attempt >= maxAttempts) {
        console.error(`Exceeded ${maxAttempts} attempts to subscribe to topic ${topicId}. Giving up.`);
        throw err;
      }
      // exponential backoff
      const delay = 250 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
      // continue loop to retry
    }
  }
}

// start mirror subscription (fire & forget)
startMirrorSubscription().catch((err) => {
  console.error("Failed to start mirror subscription:", err);
});
