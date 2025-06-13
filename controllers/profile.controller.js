const db = require('../db');

/**
 * Отримує всі необхідні дані для дашборду учня.
 */
exports.getStudentDashboard = async (req, res) => {
    const userId = req.user.id;
    try {
        const connection = await db;

        // Отримуємо чати
        const [chats] = await connection.query(`
            SELECT 
                c.id as conversation_id, 
                IF(c.user1_id = ?, u2.full_name, u1.full_name) as partner_name,
                (SELECT message_text FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
            FROM chat_conversations c 
            JOIN users u1 ON c.user1_id = u1.id 
            JOIN users u2 ON c.user2_id = u2.id 
            WHERE c.user1_id = ? OR c.user2_id = ?`,
            [userId, userId, userId, userId]
        );

        // Отримуємо залишені відгуки
        const [reviews] = await connection.query(`
            SELECT r.id, r.comment, r.rating, u.full_name as tutor_name 
            FROM reviews r 
            JOIN users u ON r.tutor_user_id = u.id
            WHERE r.student_user_id = ?
            ORDER BY r.created_at DESC`,
            [userId]
        );
        
        // Повертаємо дані у чіткій структурі
        res.json({ chats, reviews });

    } catch (error) {
        console.error("Помилка отримання даних для дашборду учня:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};

/**
 * Зберігає репетитора в обране для учня.
 */
exports.saveTutor = async (req, res) => {
    const studentId = req.user.id;
    const { tutorId } = req.body;
    try {
        await (await db).query("INSERT INTO saved_tutors (student_user_id, tutor_user_id) VALUES (?, ?)", [studentId, tutorId]);
        res.status(201).json({ message: 'Репетитора збережено в обране.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Цей репетитор вже у вашому списку обраних.' });
        }
        console.error("Помилка збереження репетитора:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};

/**
 * Видаляє репетитора з обраного.
 */
exports.unsaveTutor = async (req, res) => {
    const studentId = req.user.id;
    const { tutorId } = req.params;
    try {
        await (await db).query("DELETE FROM saved_tutors WHERE student_user_id = ? AND tutor_user_id = ?", [studentId, tutorId]);
        res.json({ message: 'Репетитора видалено з обраного.' });
    } catch (error) {
        console.error("Помилка видалення репетитора з обраного:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};



exports.getTutorProfileForEdit = async (req, res) => {
    const userId = req.user.id;
    try {
        const connection = await db;
        const [profileRows] = await connection.query("SELECT * FROM tutor_profiles WHERE user_id = ?", [userId]);
        if (profileRows.length === 0) {
            return res.status(404).json({ message: "Профіль не знайдено" });
        }
        
        const profile = profileRows[0];

        // Отримуємо УНІКАЛЬНІ ID предметів та рівнів
        const [subjects] = await connection.query("SELECT DISTINCT subject_id FROM tutor_subjects_levels WHERE tutor_user_id = ?", [userId]);
        const [levels] = await connection.query("SELECT DISTINCT level_id FROM tutor_subjects_levels WHERE tutor_user_id = ?", [userId]);

        // Повертаємо ID у вигляді простих масивів
        profile.subjects = subjects.map(s => s.subject_id);
        profile.levels = levels.map(l => l.level_id);

        res.json(profile);
    } catch (error) {
        console.error("Помилка отримання профілю для редагування:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};

/**
 * Оновлює профіль репетитора.
 */
exports.updateTutorProfile = async (req, res) => {
    const userId = req.user.id;
    const { description, education, experience_years, city, price_per_hour, lesson_format, photo_url, subjects, levels } = req.body;
    const connection = await db;
    
    try {
        await connection.beginTransaction();

        // 1. Оновлюємо основну таблицю профілю
        await connection.query(
            "UPDATE tutor_profiles SET description=?, education=?, experience_years=?, city=?, price_per_hour=?, lesson_format=?, photo_url=? WHERE user_id = ?",
            [description, education, experience_years, city, price_per_hour, lesson_format, photo_url, userId]
        );

        // 2. Видаляємо всі старі зв'язки для цього репетитора
        await connection.query("DELETE FROM tutor_subjects_levels WHERE tutor_user_id = ?", [userId]);

        // 3. Додаємо нові зв'язки
        if (Array.isArray(subjects) && Array.isArray(levels) && subjects.length > 0 && levels.length > 0) {
            const values = [];
            for (const subjectId of subjects) {
                for (const levelId of levels) {
                    values.push([userId, subjectId, levelId]);
                }
            }
            if (values.length > 0) {
                await connection.query("INSERT INTO tutor_subjects_levels (tutor_user_id, subject_id, level_id) VALUES ?", [values]);
            }
        }

        await connection.commit();
        res.json({ message: 'Профіль успішно оновлено!' });

    } catch (error) {
        await connection.rollback();
        console.error("Помилка оновлення профілю репетитора:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};
/**
 * Отримує відгуки, залишені для конкретного репетитора.
 */
exports.getTutorReviews = async (req, res) => {
    const userId = req.user.id;
    try {
        const [reviews] = await (await db).query(
            "SELECT r.*, u.full_name as student_name FROM reviews r JOIN users u ON r.student_user_id = u.id WHERE r.tutor_user_id = ? AND r.status = 'approved'",
            [userId]
        );
        res.json(reviews);
    } catch (error) {
        console.error("Помилка отримання відгуків репетитора:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};