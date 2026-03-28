import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import pairRouter from './pair.js';
import qrRouter from './qr.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure sessions directory exists
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    console.log('✅ Sessions directory created');
}

const PORT = process.env.PORT || 8000;

// Increase max listeners
import('events').then(events => {
    events.EventEmitter.defaultMaxListeners = 500;
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

// Listen on all interfaces
app.listen(PORT, '0.0.0.0', () => {
    console.log('=================================');
    console.log('✅ ZUKO-MD Bot is running!');
    console.log(`📡 Server: http://0.0.0.0:${PORT}`);
    console.log('=================================');
});

export default app;