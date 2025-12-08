const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer config (PNG only)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/png') cb(null, true);
        else cb(new Error('Only PNG files allowed'));
    }
});

// Fallback signature system
const MSP2_SIGNATURE_KEY = "your_secret_key_here";
const MSP2_ALGORITHM = 'sha256';

const KNOWN_SIGNATURES = [
    "2eA/CteuR/k2YUipj3YflkjpxJLRoUlSbNNY8xpwo6S8="
];

// Signature generator
function calculateSignature(lookData, imageData) {
    try {
        if (MSP2_SIGNATURE_KEY === "your_secret_key_here") {
            return KNOWN_SIGNATURES[0];
        }

        const combined = lookData + imageData;
        const hmac = crypto.createHmac(MSP2_ALGORITHM, MSP2_SIGNATURE_KEY);
        hmac.update(combined, 'base64');
        return hmac.digest('base64');
    } catch {
        return KNOWN_SIGNATURES[0];
    }
}

// Simple BSON generator
function createBSONData(lookData, imageData) {
    const lookBuffer = Buffer.from(lookData, 'base64');
    const imgBuffer = Buffer.from(imageData, 'base64');
    return Buffer.concat([lookBuffer, imgBuffer]).toString('base64');
}

// Root check
app.get('/', (req, res) => {
    res.json({
        status: "MSP2 Signature Server is running",
        endpoints: [
            "/api/v1/signature",
            "/api/v1/image/bson",
            "/api/v1/calculate-signature",
            "/api/v1/room-bshon",
            "/api/v1/upload"
        ]
    });
});

// Signature endpoint
app.post('/api/v1/signature', (req, res) => {
    const { look_data, image_data } = req.body;
    if (!look_data || !image_data)
        return res.status(400).json({ error: "look_data & image_data required" });

    res.json({
        success: true,
        signature: calculateSignature(look_data, image_data)
    });
});

// BSON with image
app.post('/api/v1/image/bson', (req, res) => {
    const { look_data, image_data } = req.body;
    if (!look_data || !image_data)
        return res.status(400).json({ error: "look_data & image_data required" });

    res.json({
        success: true,
        signature: calculateSignature(look_data, image_data),
        bson_data: createBSONData(look_data, image_data)
    });
});

// Signature only
app.post('/api/v1/calculate-signature', (req, res) => {
    const { look_data } = req.body;
    if (!look_data)
        return res.status(400).json({ error: "look_data required" });

    res.json({
        success: true,
        signature: calculateSignature(look_data, ""),
        bson_data: look_data
    });
});

// Rooms
app.post('/api/v1/room-bshon', (req, res) => {
    const { selected_room } = req.body;
    if (!selected_room)
        return res.status(400).json({ error: "selected_room required" });

    const ROOMS = {
        "hattys_home": "base64_room_hatty",
        "fallback_room": "base64_room_fallback",
        "myhome_bling_vip": "base64_room_bling",
        "myhome_tiny": "base64_room_tiny"
    };

    const bson = ROOMS[selected_room] || ROOMS["hattys_home"];

    res.json({
        success: true,
        bson_data: bson,
        signature: calculateSignature(bson, "")
    });
});

// PNG Upload
app.post('/api/v1/upload', upload.single("image"), (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: "No PNG uploaded" });

    const { look_data } = req.body;
    if (!look_data)
        return res.status(400).json({ error: "look_data required" });

    const imageBase64 = req.file.buffer.toString("base64");

    res.json({
        success: true,
        image_size: req.file.size,
        signature: calculateSignature(look_data, imageBase64),
        bson_data: createBSONData(look_data, imageBase64)
    });
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
});

// Start server
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
