import express from 'express';
import { makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from "@whiskeysockets/baileys";
import pino from "pino";
import { Boom } from "@hapi/boom";
import fs from "fs";
import { PhoneNumber } from 'awesome-phonenumber';

const router = express.Router();

router.get('/', async (req, res) => {
    let number = req.query.number;
    if (!number) return res.status(400).json({ error: "No Number Provided" });

    // Clean number
    const pn = new PhoneNumber(number.startsWith('+') ? number : `+${number}`);
    if (!pn.isValid()) return res.status(400).json({ error: "Invalid Number" });
    number = pn.getNumber('e164').replace('+', '');

    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${number}`);

    try {
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: ["ZUKO-MD Terminal", "Chrome", "1.0.0"]
        });

        if (!sock.authState.creds.registered) {
            await delay(1500);
            const code = await sock.requestPairingCode(number);
            console.log(`[ZUKO-MD] Pairing code generated for ${number}: ${code}`);
            res.json({ code });
        }

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(`[ZUKO-MD] Terminal ${number} Successfully Linked`);
                await delay(5000);
                // Send deployment success message to user
                await sock.sendMessage(sock.user.id, { 
                    text: `*ZUKO-MD SYSTEM LINKED*\n\nStatus: Online 🟢\nTerminal: ${number}\n\n_Your bot is now ready for deployment._` 
                });
                await sock.logout();
            }
        });

    } catch (err) {
        console.error("[ZUKO-MD] Pairing Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;