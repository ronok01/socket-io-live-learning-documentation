const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store connected users
let users = {};
let userCount = 0;

// Serve static files
app.use(express.static('public'));

// Routes for different lessons
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/lesson1', (req, res) => {
    res.sendFile(__dirname + '/public/lesson1.html');
});

app.get('/lesson2', (req, res) => {
    res.sendFile(__dirname + '/public/lesson2.html');
});

app.get('/lesson3', (req, res) => {
    res.sendFile(__dirname + '/public/lesson3.html');
});

app.get('/lesson4', (req, res) => {
    res.sendFile(__dirname + '/public/lesson4.html');
});
app.get('/lesson5', (req, res) => {
    res.sendFile(__dirname + '/public/lesson5.html');
});
app.get('/lesson6', (req, res) => {
    res.sendFile(__dirname + '/public/lesson6.html');
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);
    userCount++;
    
    // Broadcast user count to all clients
    io.emit('user count', userCount);

    // ===== LESSON 1: Basic Connection & Events =====
    socket.on('hello', (data) => {
        console.log(`👋 Hello from ${socket.id}: ${data.message}`);
        // Send response back to the sender only
        socket.emit('hello response', {
            message: `Server received: ${data.message}`,
            timestamp: new Date().toISOString()
        });
    });

    // ===== LESSON 2: Broadcasting Messages =====
    socket.on('broadcast message', (data) => {
        console.log(`📢 Broadcasting: ${data.message}`);
        // Send to all connected clients (including sender)
        io.emit('broadcast message', {
            message: data.message,
            sender: socket.id,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('broadcast to others', (data) => {
        console.log(`📢 Broadcasting to others: ${data.message}`);
        // Send to all clients EXCEPT the sender
        socket.broadcast.emit('broadcast message', {
            message: data.message,
            sender: socket.id,
            timestamp: new Date().toISOString()
        });
    });

    // ===== LESSON 3: User Management =====
    socket.on('register user', (data) => {
        const { username } = data;
        users[socket.id] = {
            id: socket.id,
            username: username,
            joinedAt: new Date().toISOString()
        };
        
        console.log(`👤 User registered: ${username} (${socket.id})`);
        
        // Send confirmation to the user
        socket.emit('user registered', {
            username: username,
            message: `Welcome ${username}! You are now connected.`
        });
        
        // Broadcast to all users that someone joined
        socket.broadcast.emit('user joined', {
            username: username,
            message: `${username} joined the chat!`
        });
        
        // Send current users list to ALL users (fix: broadcast to all, not just new user)
        io.emit('users list', Object.values(users));
    });

    // ===== LESSON 4: Private Messaging =====
    socket.on('private message', (data) => {
        const { to, message } = data;
        const sender = users[socket.id];
        
        if (!sender) {
            socket.emit('error', { message: 'Please register first!' });
            return;
        }
        
        // Find recipient by username
        const recipient = Object.values(users).find(user => user.username === to);
        
        if (recipient) {
            // Send to recipient
            io.to(recipient.id).emit('private message', {
                from: sender.username,
                message: message,
                timestamp: new Date().toISOString()
            });
            
            // Send confirmation to sender
            socket.emit('private message sent', {
                to: to,
                message: message,
                timestamp: new Date().toISOString()
            });
            
            console.log(`💬 Private message from ${sender.username} to ${to}: ${message}`);
        } else {
            socket.emit('error', { message: `User ${to} not found or not online` });
        }
    });

    // ===== LESSON 5: Rooms (Group Chat) =====
    socket.on('join room', (data) => {
        const { roomName } = data;
        const user = users[socket.id];
        
        if (!user) {
            socket.emit('error', { message: 'Please register first!' });
            return;
        }
        
        socket.join(roomName);
        console.log(`🚪 ${user.username} joined room: ${roomName}`);
        
        // Notify room members
        io.to(roomName).emit('room message', {
            type: 'join',
            user: user.username,
            room: roomName,
            message: `${user.username} joined the room`,
            timestamp: new Date().toISOString()
        });
        
        // Send confirmation to user
        socket.emit('room joined', {
            room: roomName,
            message: `You joined room: ${roomName}`
        });
    });

    socket.on('leave room', (data) => {
        const { roomName } = data;
        const user = users[socket.id];
        
        if (user) {
            socket.leave(roomName);
            console.log(`🚪 ${user.username} left room: ${roomName}`);
            
            // Notify room members
            io.to(roomName).emit('room message', {
                type: 'leave',
                user: user.username,
                room: roomName,
                message: `${user.username} left the room`,
                timestamp: new Date().toISOString()
            });
        }
    });

    socket.on('room message', (data) => {
        const { roomName, message } = data;
        const user = users[socket.id];
        
        if (!user) {
            socket.emit('error', { message: 'Please register first!' });
            return;
        }
        
        console.log(`💬 Room message in ${roomName} from ${user.username}: ${message}`);
        
        // Send message to all users in the room
        io.to(roomName).emit('room message', {
            type: 'message',
            user: user.username,
            room: roomName,
            message: message,
            timestamp: new Date().toISOString()
        });
    });

    // ===== LESSON 6: Typing Indicators =====
    socket.on('typing start', (data) => {
        const { roomName } = data;
        const user = users[socket.id];
        
        if (user) {
            socket.to(roomName).emit('user typing', {
                user: user.username,
                room: roomName
            });
        }
    });

    socket.on('typing stop', (data) => {
        const { roomName } = data;
        const user = users[socket.id];
        
        if (user) {
            socket.to(roomName).emit('user stopped typing', {
                user: user.username,
                room: roomName
            });
        }
    });

    // ===== Disconnection Handling =====
    socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.id}`);
        userCount--;
        
        const user = users[socket.id];
        if (user) {
            console.log(`👤 User left: ${user.username}`);
            
            // Broadcast to all users that someone left
            socket.broadcast.emit('user left', {
                username: user.username,
                message: `${user.username} left the chat`
            });
            
            // Remove user from users object
            delete users[socket.id];
        }
        
        // Update user count for remaining users
        io.emit('user count', userCount);
        // Send updated users list to ALL users (fix: broadcast to all)
        io.emit('users list', Object.values(users));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Socket.IO Learning Server running on port ${PORT}`);
    console.log(`📚 Available lessons:`);
    console.log(`   - http://localhost:${PORT}/ (Main page)`);
    console.log(`   - http://localhost:${PORT}/lesson1 (Basic Events)`);
    console.log(`   - http://localhost:${PORT}/lesson2 (Broadcasting)`);
    console.log(`   - http://localhost:${PORT}/lesson3 (User Management)`);
    console.log(`   - http://localhost:${PORT}/lesson4 (Private Chat)`);
    console.log(`   - http://localhost:${PORT}/lesson5 (Group Chat)`);
    console.log(`   - http://localhost:${PORT}/lesson6 (Advanced Features)`);
});
