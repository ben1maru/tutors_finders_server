const db = require('../db');

/**
 * Знаходить існуючий або створює новий діалог між двома користувачами.
 * Повертає ID діалогу.
 */
exports.findOrCreateConversation = async (req, res) => {
    const user1_id = req.user.id; // ID поточного користувача (учня)
    const { user2_id } = req.body; // ID репетитора, з яким починаємо чат

    if (!user2_id) {
        return res.status(400).json({ message: 'Не вказано ID співрозмовника.' });
    }
    if (user1_id === parseInt(user2_id, 10)) {
        return res.status(400).json({ message: 'Ви не можете почати чат із самим собою.' });
    }

    try {
        const connection = await db;
        // Сортуємо ID, щоб пара (1, 2) була такою ж, як і (2, 1)
        const [u1, u2] = [user1_id, parseInt(user2_id, 10)].sort((a, b) => a - b); 

        // Шукаємо існуючий діалог
        let [rows] = await connection.query("SELECT id FROM chat_conversations WHERE user1_id = ? AND user2_id = ?", [u1, u2]);
        
        if (rows.length > 0) {
            // Якщо діалог знайдено, повертаємо його ID
            return res.json({ conversationId: rows[0].id });
        } else {
            // Якщо ні, створюємо новий
            const [result] = await connection.query("INSERT INTO chat_conversations (user1_id, user2_id) VALUES (?, ?)", [u1, u2]);
            return res.status(201).json({ conversationId: result.insertId });
        }
    } catch (error) {
        console.error("Помилка створення/пошуку діалогу:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};