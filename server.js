const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (in production, use a proper database)
let trades = [];
let notifications = [];

// Helper function to create notification
function createNotification(type, userId, data) {
    const notification = {
        id: uuidv4(),
        type,
        userId,
        data,
        timestamp: new Date().toISOString(),
        read: false
    };
    notifications.push(notification);
    return notification;
}

// Helper function to update trade status
function updateTradeStatus(tradeId, status, additionalData = {}) {
    const tradeIndex = trades.findIndex(t => t.id === tradeId);
    if (tradeIndex !== -1) {
        trades[tradeIndex].status = status;
        trades[tradeIndex].updatedAt = new Date().toISOString();
        Object.assign(trades[tradeIndex], additionalData);
        return trades[tradeIndex];
    }
    return null;
}

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create new trade
app.post('/api/trades', (req, res) => {
    try {
        const {
            senderProfileId,
            senderUsername,
            receiverProfileId,
            receiverUsername,
            itemId,
            objectId,
            itemName,
            defaultColors,
            region
        } = req.body;

        // Validate required fields
        if (!senderProfileId || !receiverProfileId || !itemId || !objectId || !itemName) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['senderProfileId', 'receiverProfileId', 'itemId', 'objectId', 'itemName']
            });
        }

        const trade = {
            id: uuidv4(),
            senderProfileId,
            senderUsername,
            receiverProfileId,
            receiverUsername,
            itemId,
            objectId,
            itemName,
            defaultColors: defaultColors || [],
            region: region || 'us',
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            counterOffers: []
        };

        trades.push(trade);

        // Create notification for receiver
        createNotification('trade_offer', receiverProfileId, {
            tradeId: trade.id,
            fromUser: senderUsername,
            itemName: itemName,
            message: `${senderUsername} wants to trade ${itemName} with you`
        });

        res.status(201).json({
            success: true,
            trade: trade
        });
    } catch (error) {
        console.error('Error creating trade:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get sent trades for a user
app.get('/api/trades/sent/:profileId', (req, res) => {
    try {
        const { profileId } = req.params;
        const userSentTrades = trades
            .filter(trade => trade.senderProfileId === profileId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json(userSentTrades);
    } catch (error) {
        console.error('Error fetching sent trades:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get received trades for a user
app.get('/api/trades/received/:profileId', (req, res) => {
    try {
        const { profileId } = req.params;
        const userReceivedTrades = trades
            .filter(trade => trade.receiverProfileId === profileId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json(userReceivedTrades);
    } catch (error) {
        console.error('Error fetching received trades:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get trade offers for a user (pending trades they received)
app.get('/api/trades/offers/:profileId', (req, res) => {
    try {
        const { profileId } = req.params;
        const userOffers = trades
            .filter(trade => trade.receiverProfileId === profileId && trade.status === 'pending')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json(userOffers);
    } catch (error) {
        console.error('Error fetching trade offers:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Accept trade offer
app.post('/api/trades/:tradeId/accept', (req, res) => {
    try {
        const { tradeId } = req.params;
        const trade = trades.find(t => t.id === tradeId);
        
        if (!trade) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        if (trade.status !== 'pending') {
            return res.status(400).json({ 
                error: 'Trade is no longer pending',
                currentStatus: trade.status 
            });
        }

        // Update trade status to accepted
        updateTradeStatus(tradeId, 'accepted');

        // Create notification for sender
        createNotification('trade_accepted', trade.senderProfileId, {
            tradeId: tradeId,
            fromUser: trade.receiverUsername,
            itemName: trade.itemName,
            message: `${trade.receiverUsername} accepted your trade offer for ${trade.itemName}`
        });

        res.json({
            success: true,
            message: 'Trade offer accepted',
            trade: trades.find(t => t.id === tradeId)
        });
    } catch (error) {
        console.error('Error accepting trade:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Reject trade offer
app.post('/api/trades/:tradeId/reject', (req, res) => {
    try {
        const { tradeId } = req.params;
        const trade = trades.find(t => t.id === tradeId);
        
        if (!trade) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        if (trade.status !== 'pending') {
            return res.status(400).json({ 
                error: 'Trade is no longer pending',
                currentStatus: trade.status 
            });
        }

        // Update trade status to rejected
        updateTradeStatus(tradeId, 'rejected');

        // Create notification for sender
        createNotification('trade_rejected', trade.senderProfileId, {
            tradeId: tradeId,
            fromUser: trade.receiverUsername,
            itemName: trade.itemName,
            message: `${trade.receiverUsername} rejected your trade offer for ${trade.itemName}`
        });

        res.json({
            success: true,
            message: 'Trade offer rejected',
            trade: trades.find(t => t.id === tradeId)
        });
    } catch (error) {
        console.error('Error rejecting trade:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get tracking data for a user
app.get('/api/trades/tracking/:profileId', (req, res) => {
    try {
        const { profileId } = req.params;
        const userTrades = trades.filter(trade => 
            trade.senderProfileId === profileId || trade.receiverProfileId === profileId
        );

        const trackingData = userTrades.map(trade => {
            const isInitiator = trade.senderProfileId === profileId;
            const otherUserId = isInitiator ? trade.receiverProfileId : trade.senderProfileId;
            const otherUsername = isInitiator ? trade.receiverUsername : trade.senderUsername;

            return {
                id: trade.id,
                otherUserId,
                otherUsername,
                itemName: trade.itemName,
                status: trade.status,
                createdAt: trade.createdAt,
                updatedAt: trade.updatedAt,
                isInitiator
            };
        }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        res.json(trackingData);
    } catch (error) {
        console.error('Error fetching tracking data:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get notifications for a user
app.get('/api/notifications/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const userNotifications = notifications
            .filter(notification => notification.userId === userId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50); // Limit to last 50 notifications

        res.json(userNotifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Mark notification as read
app.patch('/api/notifications/:notificationId/read', (req, res) => {
    try {
        const { notificationId } = req.params;
        const notification = notifications.find(n => n.id === notificationId);
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        notification.read = true;
        
        res.json({
            success: true,
            notification
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Complete trade (simulate MSP2 gift API call)
app.post('/api/trades/:tradeId/complete', (req, res) => {
    try {
        const { tradeId } = req.params;
        const { counterItemId, counterObjectId, counterItemName, counterDefaultColors } = req.body;
        
        const trade = trades.find(t => t.id === tradeId);
        
        if (!trade) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        if (trade.status !== 'accepted') {
            return res.status(400).json({ 
                error: 'Trade must be accepted before completion',
                currentStatus: trade.status 
            });
        }

        // Update trade with counter-offer details and mark as completed
        updateTradeStatus(tradeId, 'completed', {
            counterItemId,
            counterObjectId,
            counterItemName,
            counterDefaultColors,
            completedAt: new Date().toISOString()
        });

        // Create notifications for both users
        createNotification('trade_completed', trade.senderProfileId, {
            tradeId: tradeId,
            fromUser: trade.receiverUsername,
            itemReceived: counterItemName,
            itemGiven: trade.itemName,
            message: `Trade completed! You gave ${trade.itemName} and received ${counterItemName} from ${trade.receiverUsername}`
        });

        createNotification('trade_completed', trade.receiverProfileId, {
            tradeId: tradeId,
            fromUser: trade.senderUsername,
            itemReceived: trade.itemName,
            itemGiven: counterItemName,
            message: `Trade completed! You gave ${counterItemName} and received ${trade.itemName} from ${trade.senderUsername}`
        });

        res.json({
            success: true,
            message: 'Trade completed successfully',
            trade: trades.find(t => t.id === tradeId)
        });
    } catch (error) {
        console.error('Error completing trade:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get all trades (admin endpoint)
app.get('/api/trades', (req, res) => {
    try {
        const { status, limit = 100 } = req.query;
        let filteredTrades = trades;

        if (status) {
            filteredTrades = trades.filter(trade => trade.status === status);
        }

        const limitedTrades = filteredTrades
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, parseInt(limit));

        res.json({
            trades: limitedTrades,
            total: filteredTrades.length,
            stats: {
                pending: trades.filter(t => t.status === 'pending').length,
                accepted: trades.filter(t => t.status === 'accepted').length,
                completed: trades.filter(t => t.status === 'completed').length,
                rejected: trades.filter(t => t.status === 'rejected').length
            }
        });
    } catch (error) {
        console.error('Error fetching all trades:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Delete trade (admin endpoint)
app.delete('/api/trades/:tradeId', (req, res) => {
    try {
        const { tradeId } = req.params;
        const tradeIndex = trades.findIndex(t => t.id === tradeId);
        
        if (tradeIndex === -1) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        const deletedTrade = trades.splice(tradeIndex, 1)[0];
        
        res.json({
            success: true,
            message: 'Trade deleted successfully',
            deletedTrade
        });
    } catch (error) {
        console.error('Error deleting trade:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        method: req.method
    });
});

// Start server
app.listen(port, () => {
    console.log(`Trade server is running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
});

module.exports = app;
