import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';

// Import only pair router (QR removed)
import pairRouter from './pair.js';

const app = express();

// Resolve the current directory path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;

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

app.use('/pair', pairRouter);
// QR route completely removed

app.listen(PORT, () => {
    console.log(`ZUKO-MD Server Running`);
    console.log(`YouTube: @mr_unique_hacker`);
    console.log(`GitHub: @mruniquehacker`);
    console.log(`Server: http://localhost:${PORT}`);
});

export default app;