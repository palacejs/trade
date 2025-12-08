const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Only PNG files are allowed'), false);
        }
    }
});

// MSP2 Signature calculation constants
const MSP2_SIGNATURE_KEY = "your_secret_key_here"; // Bu key'i MSP2'den almanız gerekiyor
const MSP2_ALGORITHM = 'sha256';

// Bilinen working signature'lar (reverse engineering için)
const KNOWN_SIGNATURES = [
    "2eA/CteuR/k2YUipj3YflkjpxJLRoUlSbNNY8xpwo6S8=", // Default avatar signature
    // Buraya yakaladığınız signature'ları ekleyin
];

// Helper functions
function calculateSignature(lookData, imageData) {
    try {
        // Eğer gerçek key yoksa, bilinen signature'ları kullan
        if (MSP2_SIGNATURE_KEY === "your_secret_key_here") {
            console.log("⚠️  Using fallback signature method");
            return KNOWN_SIGNATURES[0]; // Default signature kullan
        }
        
        // Combine look data and image data
        const combinedData = lookData + imageData;
        
        // Create HMAC signature
        const hmac = crypto.createHmac(MSP2_ALGORITHM, MSP2_SIGNATURE_KEY);
        hmac.update(combinedData, 'base64');
        const signature = hmac.digest('base64');
        
        return signature;
    } catch (error) {
        console.log("❌ Signature calculation failed, using fallback");
        return KNOWN_SIGNATURES[0];
    }
}

function createBSONData(lookData, imageData) {
    try {
        // Decode base64 data
        const lookBuffer = Buffer.from(lookData, 'base64');
        const imageBuffer = Buffer.from(imageData, 'base64');
        
        // Create a simple BSON-like structure
        // This is a simplified version - actual BSON implementation may be more complex
        const bsonData = Buffer.concat([
            lookBuffer,
            imageBuffer
        ]);
        
        return bsonData.toString('base64');
    } catch (error) {
        throw new Error('BSON data creation failed: ' + error.message);
    }
}

// Routes

// Health check
app.get('/', (req, res) => {
    res.json({ 
        status: 'MSP2 Signature Server is running',
        version: '1.0.0',
        endpoints: [
            'POST /api/v1/signature',
            'POST /api/v1/image/bson',
            'POST /api/v1/calculate-signature',
            'POST /api/v1/room-bshon'
        ]
    });
});

// Calculate signature endpoint
app.post('/api/v1/signature', (req, res) => {
    try {
        const { look_data, image_data } = req.body;
        
        if (!look_data || !image_data) {
            return res.status(400).json({
                error: 'Missing required fields: look_data and image_data'
            });
        }
        
        const signature = calculateSignature(look_data, image_data);
        
        res.json({
            signature: signature,
            success: true
        });
        
    } catch (error) {
        console.error('Signature calculation error:', error);
        res.status(500).json({
            error: 'Failed to calculate signature',
            message: error.message
        });
    }
});

// Create BSON data with image
app.post('/api/v1/image/bson', (req, res) => {
    try {
        const { look_data, image_data } = req.body;
        
        if (!look_data || !image_data) {
            return res.status(400).json({
                error: 'Missing required fields: look_data and image_data'
            });
        }
        
        const signature = calculateSignature(look_data, image_data);
        const bsonData = createBSONData(look_data, image_data);
        
        res.json({
            signature: signature,
            bson_data: bsonData,
            success: true
        });
        
    } catch (error) {
        console.error('BSON creation error:', error);
        res.status(500).json({
            error: 'Failed to create BSON data',
            message: error.message
        });
    }
});

// Calculate signature for existing look data
app.post('/api/v1/calculate-signature', (req, res) => {
    try {
        const { look_data } = req.body;
        
        if (!look_data) {
            return res.status(400).json({
                error: 'Missing required field: look_data'
            });
        }
        
        const signature = calculateSignature(look_data, '');
        
        res.json({
            signature: signature,
            bson_data: look_data,
            success: true
        });
        
    } catch (error) {
        console.error('Signature calculation error:', error);
        res.status(500).json({
            error: 'Failed to calculate signature',
            message: error.message
        });
    }
});

// Room BSON data endpoint
app.post('/api/v1/room-bshon', (req, res) => {
    try {
        const { selected_room } = req.body;
        
        if (!selected_room) {
            return res.status(400).json({
                error: 'Missing required field: selected_room'
            });
        }
        
        // Predefined room data - you'll need to populate this with actual room data
        const roomData = {
            'hattys_home': 'base64_room_data_for_hattys_home',
            'fallback_room': 'base64_room_data_for_fallback_room',
            'myhome_bling_vip': 'base64_room_data_for_bling_vip',
            'myhome_tiny': 'base64_room_data_for_tiny_home',
            // Add more rooms as needed
        };
        
        const bsonData = roomData[selected_room] || roomData['hattys_home'];
        const signature = calculateSignature(bsonData, '');
        
        res.json({
            bson_data: bsonData,
            signature: signature,
            success: true
        });
        
    } catch (error) {
        console.error('Room BSON error:', error);
        res.status(500).json({
            error: 'Failed to get room BSON data',
            message: error.message
        });
    }
});

// File upload endpoint for PNG images
app.post('/api/v1/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file uploaded'
            });
        }
        
        const { look_data } = req.body;
        
        if (!look_data) {
            return res.status(400).json({
                error: 'Missing look_data parameter'
            });
        }
        
        // Process the uploaded image
        const processedImage = await sharp(req.file.buffer)
            .png()
            .resize(200, 200, { 
                fit: 'cover',
                position: 'center'
            })
            .toBuffer();
        
        const imageBase64 = processedImage.toString('base64');
        const signature = calculateSignature(look_data, imageBase64);
        const bsonData = createBSONData(look_data, imageBase64);
        
        res.json({
            signature: signature,
            bson_data: bsonData,
            image_size: processedImage.length,
            success: true
        });
        
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({
            error: 'Failed to process uploaded image',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large. Maximum size is 10MB.'
            });
        }
    }
    
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        available_endpoints: [
            'POST /api/v1/signature',
            'POST /api/v1/image/bson',
            'POST /api/v1/calculate-signature',
            'POST /api/v1/room-bshon',
            'POST /api/v1/upload'
        ]
    });
});

app.listen(PORT, () => {
    console.log(`MSP2 Signature Server is running on port ${PORT}`);
    console.log(`Available at: http://localhost:${PORT}`);
    console.log('Endpoints:');
    console.log('  POST /api/v1/signature - Calculate signature for look and image data');
    console.log('  POST /api/v1/image/bson - Create BSON data with image');
    console.log('  POST /api/v1/calculate-signature - Calculate signature for look data only');
    console.log('  POST /api/v1/room-bshon - Get room BSON data');
    console.log('  POST /api/v1/upload - Upload PNG file and process');
});

module.exports = app;
