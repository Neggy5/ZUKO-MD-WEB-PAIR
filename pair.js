import express from 'express';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } from "@whiskeysockets/baileys";
import pino from "pino";
import { PhoneNumber } from 'awesome-phonenumber';

const router = express.Router();

router.get('/', async (req, res) => {
    let number = req.query.number;
    
    console.log(`📞 Pairing request received for: ${number}`);
    
    if (!number) {
        return res.status(400).json({ error: "No Number Provided" });
    }

    // Clean number
    const pn = new PhoneNumber(number.startsWith('+') ? number : `+${number}`);
    if (!pn.isValid()) {
        return res.status(400).json({ error: "Invalid Number" });
    }
    number = pn.getNumber('e164').replace('+', '');
    
    let responseSent = false;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${number}`);

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: ["ZUKO-MD Terminal", "Chrome", "1.0.0"]
        });

        // Generate pairing code
        if (!sock.authState.creds.registered) {
            await delay(1500);
            const code = await sock.requestPairingCode(number);
            console.log(`✅ Pairing code generated for ${number}: ${code}`);
            
            if (!responseSent) {
                responseSent = true;
                return res.json({ code: code });
            }
        } else {
            if (!responseSent) {
                responseSent = true;
                return res.json({ error: "Already registered", code: null });
            }
        }

        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                console.log(`✅ Terminal ${number} Successfully Linked!`);
                await delay(5000);
                await sock.sendMessage(sock.user.id, { 
                    text: `*ZUKO-MD SYSTEM LINKED*\n\nStatus: Online 🟢\nTerminal: ${number}\n\n_Your bot is now ready for deployment._` 
                });
                await sock.logout();
            }
        });

        // Timeout to prevent hanging
        setTimeout(() => {
            if (!responseSent) {
                responseSent = true;
                res.status(504).json({ error: "Request timeout" });
            }
        }, 30000);

    } catch (err) {
        console.error("❌ Pairing Error:", err);
        if (!responseSent) {
            responseSent = true;
            res.status(500).json({ error: "Internal Server Error: " + err.message });
        }
    }
});

export default router;