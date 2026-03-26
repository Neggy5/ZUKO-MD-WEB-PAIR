import express from 'express';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from 'qrcode';
import fs from "fs";

const router = express.Router();

router.get('/', async (req, res) => {
    const sessionID = `ZUKO_QR_${Math.floor(Math.random() * 10000)}`;
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionID}`);

    try {
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: ["ZUKO-MD Scanner", "Safari", "2.0.0"]
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;

            if (qr) {
                const qrDataUrl = await QRCode.toDataURL(qr);
                res.json({ 
                    qr: qrDataUrl, 
                    instructions: ["1. Open WhatsApp", "2. Go to Linked Devices", "3. Scan ZUKO-MD Terminal QR"] 
                });
            }

            if (connection === 'open') {
                console.log(`[ZUKO-MD] QR Connection Successful: ${sessionID}`);
                await sock.sendMessage(sock.user.id, { 
                    text: `*ZUKO-MD QR AUTHENTICATION COMPLETE*\n\nYour session is now active.` 
                });
                // Cleanup logic here if needed
            }
        });

    } catch (err) {
        console.error("[ZUKO-MD] QR Error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Failed to generate QR" });
    }
});

export default router;