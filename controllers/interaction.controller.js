const db = require('../db');

/**
 * Створює або знаходить існуючий чат між двома користувачами.
 * @description Приймає ID репетитора, знаходить/створює діалог і повертає його ID.
 */
exports.startOrGetChat = async (req, res) => {
    const studentId = req.user.id;
    const { tutorId } = req.body;

    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Тільки учень може починати чат з репетитором.' });
    }
    if (!tutorId) {
        return res.status(400).json({ message: 'Не вказано ID репетитора.' });
    }

    try {
        const connection = await db;
        // Сортуємо ID, щоб пара (1, 2) була такою ж, як і (2, 1)
        const [u1, u2] = [studentId, parseInt(tutorId)].sort((a, b) => a - b); 

        let [rows] = await connection.query("SELECT id FROM chat_conversations WHERE user1_id = ? AND user2_id = ?", [u1, u2]);
        let conversationId;

        if (rows.length > 0) {
            // Якщо діалог вже існує
            conversationId = rows[0].id;
        } else {
            // Якщо діалогу немає, створюємо новий
            const [result] = await connection.query("INSERT INTO chat_conversations (user1_id, user2_id) VALUES (?, ?)", [u1, u2]);
            conversationId = result.insertId;
        }

        res.status(200).json({ conversationId });

    } catch (error) {
        console.error("Помилка створення/отримання чату:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};

exports.leaveReview = async (req, res) => {
    const studentId = req.user.id;
    const { tutorId, rating, comment } = req.body;

    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Тільки учень може залишати відгуки.' });
    }
    if (!tutorId || !rating) {
        return res.status(400).json({ message: 'Необхідно вказати ID репетитора та рейтинг.' });
    }

    const connection = await db;

    try {
        await connection.beginTransaction();

        // 1. Створюємо відгук одразу зі статусом 'approved'
        await connection.query(
            "INSERT INTO reviews (student_user_id, tutor_user_id, rating, comment, status) VALUES (?, ?, ?, ?, 'approved')",
            [studentId, parseInt(tutorId), rating, comment]
        );

        // 2. Одразу перераховуємо середній рейтинг репетитора
        const [avgRows] = await connection.query(
            "SELECT AVG(rating) as avg_rating FROM reviews WHERE tutor_user_id = ? AND status = 'approved'",
            [parseInt(tutorId)]
        );
const newRating = Number(avgRows[0]?.avg_rating) || 0;
await connection.query(
    "UPDATE tutor_profiles SET average_rating = ? WHERE user_id = ?",
    [newRating.toFixed(2), parseInt(tutorId)]
);


        await connection.commit();
        res.status(201).json({ message: 'Дякуємо! Ваш відгук успішно опубліковано.' });

    } catch (error) {
        await connection.rollback();
        console.error("Помилка створення відгуку:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};