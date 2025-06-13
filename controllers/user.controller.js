const db = require('../db');

// Залишити відгук
exports.leaveReview = async (req, res) => {
    const { tutorId, rating, comment } = req.body;
    const studentId = req.user.id;
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Тільки учень може залишати відгуки' });
        }
        await (await db).query(
            "INSERT INTO reviews (student_user_id, tutor_user_id, rating, comment) VALUES (?, ?, ?, ?)",
            [studentId, tutorId, rating, comment]
        );
        res.status(201).json({ message: 'Ваш відгук додано і відправлено на модерацію.' });
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера', error: error.message });
    }
};

// Отримати список своїх чатів (розмов)
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const sql = `
            SELECT 
                c.id as conversation_id,
                IF(c.user1_id = ?, u2.id, u1.id) as partner_id,
                IF(c.user1_id = ?, u2.full_name, u1.full_name) as partner_name,
                (SELECT message_text FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_date
            FROM chat_conversations c
            JOIN users u1 ON c.user1_id = u1.id
            JOIN users u2 ON c.user2_id = u2.id
            WHERE c.user1_id = ? OR c.user2_id = ?
            ORDER BY last_message_date DESC
        `;
        const [conversations] = await (await db).query(sql, [userId, userId, userId, userId]);
        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера', error: error.message });
    }
};

// Отримати повідомлення конкретного чату
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const [messages] = await (await db).query("SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC", [conversationId]);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера', error: error.message });
    }
};