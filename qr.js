import express from 'express';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from 'qrcode';
import fs from "fs";

const router = express.Router();

router.get('/', async (req, res) => {
    const sessionID = `ZUKO_QR_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    let qrSent = false;
    let responseSent = false;
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionID}`);

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: ["ZUKO-MD Scanner", "Safari", "2.0.0"],
            markOnlineOnConnect: true,
            syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);
        
        // Set up connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            if (qr && !qrSent && !responseSent) {
                qrSent = true;
                try {
                    const qrDataUrl = await QRCode.toDataURL(qr);
                    res.json({ 
                        qr: qrDataUrl, 
                        instructions: ["1. Open WhatsApp", "2. Go to Linked Devices", "3. Scan ZUKO-MD Terminal QR"],
                        sessionId: sessionID
                    });
                    responseSent = true;
                } catch (err) {
                    console.error("QR generation error:", err);
                    if (!responseSent) {
                        res.status(500).json({ error: "Failed to generate QR code" });
                        responseSent = true;
                    }
                }
            }
            
            if (connection === 'open') {
                console.log(`[ZUKO-MD] QR Connection Successful: ${sessionID}`);
                
                try {
                    // Send confirmation message
                    if (sock.user) {
                        await sock.sendMessage(sock.user.id, { 
                            text: `*ZUKO-MD QR AUTHENTICATION COMPLETE*\n\nYour session is now active.\nSession ID: ${sessionID}` 
                        });
                    }
                } catch (err) {
                    console.error("Failed to send confirmation:", err);
                }
                
                // Close connection after successful pairing
                await delay(3000);
                await sock.logout();
            }
            
            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log(`[ZUKO-MD] QR Connection closed, status: ${statusCode}, should reconnect: ${shouldReconnect}`);
                
                if (!shouldReconnect) {
                    console.log("User logged out, cleaning up session...");
                    // Cleanup session files if needed
                    try {
                        if (fs.existsSync(`./sessions/${sessionID}`)) {
                            fs.rmSync(`./sessions/${sessionID}`, { recursive: true, force: true });
                        }
                    } catch (err) {
                        console.error("Cleanup error:", err);
                    }
                }
            }
        });
        
        // Handle errors
        sock.ev.on('error', (error) => {
            console.error("Socket error:", error);
            if (!responseSent) {
                res.status(500).json({ error: "Connection error occurred: " + error.message });
                responseSent = true;
            }
        });
        
        // Set timeout for QR generation
        setTimeout(() => {
            if (!qrSent && !responseSent) {
                res.status(408).json({ error: "QR generation timeout" });
                responseSent = true;
            }
        }, 30000);
        
    } catch (err) {
        console.error("[ZUKO-MD] QR Error:", err);
        if (!responseSent) {
            res.status(500).json({ error: "Failed to generate QR: " + err.message });
        }
    }
});

export default router;