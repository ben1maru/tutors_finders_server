// index.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io"); // ✅ обов’язково для Socket.IO
const cors = require('cors');
require('dotenv').config();

const db = require('./db');

// Імпорт всіх маршрутів
const authRoutes = require('./route/auth.route');
const dataRoutes = require('./route/data.route');
const userRoutes = require('./route/user.route');
const adminRoutes = require('./route/admin.route');
const profileRoutes = require('./route/profile.route');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API маршрути
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);

// --- Socket.IO логіка ---
const onlineUsers = new Map();

const io = new Server(server, {
    cors: {
        origin: "*", // або вкажіть конкретне джерело: "http://localhost:3000"
    }
});

io.on('connection', (socket) => {
    console.log(`[Socket.IO] A user connected with socket ID: ${socket.id}`);

    socket.on('join', (userId) => {
        const userIdStr = userId.toString();
        onlineUsers.set(userIdStr, socket.id);
        console.log(`[Socket.IO] User ${userIdStr} joined. Online users:`, Array.from(onlineUsers.keys()));
    });

    socket.on('sendMessage', async ({ senderId, receiverId, text }, callback) => {
        try {
            const connection = await db;

            // Отримання або створення бесіди
            const [u1, u2] = [senderId, receiverId].sort((a, b) => a - b);
            let [convRows] = await connection.query(
                "SELECT id FROM chat_conversations WHERE user1_id = ? AND user2_id = ?",
                [u1, u2]
            );

            let conversationId;
            if (convRows.length > 0) {
                conversationId = convRows[0].id;
            } else {
                const [res] = await connection.query(
                    "INSERT INTO chat_conversations (user1_id, user2_id) VALUES (?, ?)",
                    [u1, u2]
                );
                conversationId = res.insertId;
            }

            // Збереження повідомлення
            const [msgResult] = await connection.query(
                "INSERT INTO chat_messages (conversation_id, sender_id, message_text) VALUES (?, ?, ?)",
                [conversationId, senderId, text]
            );

            const [newMsgRows] = await connection.query(
                "SELECT * FROM chat_messages WHERE id = ?",
                [msgResult.insertId]
            );

            const message = newMsgRows[0];
            const receiverSocketId = onlineUsers.get(receiverId.toString());

            console.log(`[Socket.IO] Sending message to user ${receiverId}, socket ID: ${receiverSocketId}`);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receiveMessage', message);
                console.log(`[Socket.IO] Message sent to user ${receiverId}`);
            } else {
                console.log(`[Socket.IO] User ${receiverId} is offline.`);
            }

            if (typeof callback === 'function') {
                callback({ status: 'ok', message });
            }
        } catch (error) {
            console.error('[Socket.IO] sendMessage error:', error);
            if (typeof callback === 'function') {
                callback({ status: 'error', message: 'Помилка на сервері' });
            }
        }
    });

    socket.on('disconnect', () => {
        for (let [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                console.log(`[Socket.IO] User ${userId} disconnected. Current online:`, Array.from(onlineUsers.keys()));
                break;
            }
        }
    });
});

// Запуск сервера
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await (await db).connect();
        console.log('✅ MySQL Database connected.');
        server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    } catch (error) {
        console.error('❌ Unable to connect to DB:', error);
        process.exit(1);
    }
};

startServer();
