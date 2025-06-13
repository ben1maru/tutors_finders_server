const db = require('../db');
const slugify = require('slugify'); // Переконайтесь, що ви встановили: npm install slugify

/**
 * Допоміжна функція для запису дій адміністратора в базу даних.
 * @param {number} adminId - ID адміністратора, який виконав дію.
 * @param {string} action - Опис дії, що буде збережено в логах.
 */
const logAdminAction = async (adminId, action) => {
    try {
        await (await db).query("INSERT INTO admin_logs (admin_user_id, action) VALUES (?, ?)", [adminId, action]);
    } catch (error) {
        console.error("Помилка при записі логу адміністратора:", error);
    }
};

// --- ДАШБОРД ---
/**
 * Отримує основну статистику для дашборду адміністратора.
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const connection = await db;
        const [[{ count: usersCount }]] = await connection.query("SELECT COUNT(*) as count FROM users");
        const [[{ count: approvedTutors }]] = await connection.query("SELECT COUNT(*) as count FROM tutor_profiles WHERE status = 'approved'");
        const [[{ count: pendingTutors }]] = await connection.query("SELECT COUNT(*) as count FROM tutor_profiles WHERE status = 'pending'");
        const [[{ count: pendingReviews }]] = await connection.query("SELECT COUNT(*) as count FROM reviews WHERE status = 'pending'");
        
        res.json({ usersCount, approvedTutors, pendingTutors, pendingReviews });
    } catch (error) {
        console.error("Помилка отримання статистики:", error);
        res.status(500).json({ message: 'Помилка сервера при отриманні статистики' });
    }
};

// --- КЕРУВАННЯ КОРИСТУВАЧАМИ ---
/**
 * Отримує список всіх зареєстрованих користувачів.
 */
exports.getAllUsers = async (req, res) => {
    try {
        const connection = await db;
        const [users] = await connection.query("SELECT id, email, full_name, role, is_blocked, created_at FROM users ORDER BY created_at DESC");
        res.json(users);
    } catch (error) {
        console.error("Помилка отримання списку користувачів:", error);
        res.status(500).json({ message: 'Помилка сервера при отриманні списку користувачів' });
    }
};

/**
 * Блокує або розблоковує користувача.
 */
exports.toggleUserBlock = async (req, res) => {
    const { userId } = req.params;
    const { block } = req.body;

    try {
        const connection = await db;
        await connection.query("UPDATE users SET is_blocked = ? WHERE id = ?", [block, userId]);
        
        const actionText = `${block ? 'Заблокував' : 'Розблокував'} користувача з ID ${userId}`;
        await logAdminAction(req.user.id, actionText);
        
        res.json({ message: `Статус блокування користувача успішно оновлено.` });
    } catch (error) {
        console.error("Помилка блокування/розблокування користувача:", error);
        res.status(500).json({ message: 'Помилка сервера при зміні статусу користувача' });
    }
};
exports.getTutorsForAdmin = async (req, res) => {
    const { status } = req.query;
    
    let sql = `
        SELECT 
            u.id, 
            u.full_name, 
            u.email, 
            p.status, 
            p.city,
            p.experience_years,
            u.created_at -- ВИПРАВЛЕНО: беремо дату створення з таблиці users (u)
        FROM users u
        INNER JOIN tutor_profiles p ON u.id = p.user_id
        WHERE u.role = 'tutor'
    `;
    
    const params = [];

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        sql += ` AND p.status = ?`;
        params.push(status);
    }
    
    // ВИПРАВЛЕНО: сортуємо за датою створення користувача
    sql += ` ORDER BY u.created_at DESC`;

    try {
        const connection = await db;
        const [tutors] = await connection.query(sql, params);
        res.json(tutors);
    } catch (error) {
        console.error("SQL Error in getTutorsForAdmin:", error);
        res.status(500).json({ message: 'Помилка сервера при отриманні анкет репетиторів.' });
    }
};

/**
 * Схвалює або відхиляє анкету репетитора.
 */
exports.moderateTutor = async (req, res) => {
    const { tutorId } = req.params;
    const { status } = req.body;

    if (status !== 'approved' && status !== 'rejected') {
        return res.status(400).json({ message: "Неправильний статус." });
    }

    try {
        await (await db).query("UPDATE tutor_profiles SET status = ? WHERE user_id = ?", [status, tutorId]);
        await logAdminAction(req.user.id, `${status === 'approved' ? 'Схвалив' : 'Відхилив'} анкету репетитора ID ${tutorId}`);
        res.json({ message: 'Статус анкети оновлено.' });
    } catch (error) {
        console.error("Помилка модерації анкети:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};
/**
 * Схвалює або відхиляє анкету репетитора.
 */
exports.moderateTutor = async (req, res) => {
    const { tutorId } = req.params;
    const { status } = req.body;

    if (status !== 'approved' && status !== 'rejected') {
        return res.status(400).json({ message: "Неправильний статус." });
    }

    try {
        await (await db).query("UPDATE tutor_profiles SET status = ? WHERE user_id = ?", [status, tutorId]);
        const actionText = `${status === 'approved' ? 'Схвалив' : 'Відхилив'} анкету репетитора ID ${tutorId}`;
        await logAdminAction(req.user.id, actionText);
        res.json({ message: 'Статус анкети оновлено.' });
    } catch (error) {
        console.error("Помилка модерації анкети:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};

// --- МОДЕРАЦІЯ ВІДГУКІВ ---
/**
 * Отримує список всіх відгуків для адмін-панелі.
 */
exports.getReviewsForAdmin = async (req, res) => {
    try {
        const [reviews] = await (await db).query(`
            SELECT r.*, u_student.full_name as student_name, u_tutor.full_name as tutor_name 
            FROM reviews r 
            LEFT JOIN users u_student ON r.student_user_id = u_student.id 
            JOIN users u_tutor ON r.tutor_user_id = u_tutor.id 
            ORDER BY r.created_at DESC
        `);
        res.json(reviews);
    } catch (error) {
        console.error("Помилка отримання відгуків для адміна:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};

/**
 * Видаляє відгук за його ID.
 */
exports.deleteReview = async (req, res) => {
    const { reviewId } = req.params;
    try {
        const [result] = await (await db).query("DELETE FROM reviews WHERE id = ?", [reviewId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Відгук не знайдено.' });
        }
        await logAdminAction(req.user.id, `Видалив відгук ID ${reviewId}`);
        res.json({ message: 'Відгук успішно видалено.' });
    } catch (error) {
        console.error("Помилка видалення відгука:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};

// --- КЕРУВАННЯ БЛОГОМ ---
/**
 * Створює новий пост у блозі.
 */
exports.createBlogPost = async (req, res) => {
    const { title, content, cover_image_url } = req.body;
    try {
        if (!title || !content) {
            return res.status(400).json({ message: "Заголовок та вміст новини є обов'язковими." });
        }
        const slug = slugify(title, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
        const connection = await db;
        const [existing] = await connection.query("SELECT id FROM blog_posts WHERE slug = ?", [slug]);
        let finalSlug = slug;
        if (existing.length > 0) {
            finalSlug = `${slug}-${Date.now()}`;
        }
        await connection.query(
            "INSERT INTO blog_posts (admin_user_id, title, content, cover_image_url, slug) VALUES (?, ?, ?, ?, ?)",
            [req.user.id, title, content, cover_image_url, finalSlug]
        );
        await logAdminAction(req.user.id, `Створив новину в блозі: "${title}"`);
        res.status(201).json({ message: 'Новину успішно створено' });
    } catch (error) {
        console.error("Помилка створення новини:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};

/**
 * Оновлює існуючий пост у блозі.
 */
exports.updateBlogPost = async (req, res) => {
    const { postId } = req.params;
    const { title, content, cover_image_url } = req.body;
    try {
        if (!title || !content) {
            return res.status(400).json({ message: "Заголовок та вміст новини є обов'язковими." });
        }
        const newSlug = slugify(title, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
        const connection = await db;
        const [existing] = await connection.query("SELECT id FROM blog_posts WHERE slug = ? AND id != ?", [newSlug, postId]);
        let finalSlug = newSlug;
        if (existing.length > 0) {
            finalSlug = `${newSlug}-${Date.now()}`;
        }
        const [result] = await connection.query(
            "UPDATE blog_posts SET title = ?, content = ?, cover_image_url = ?, slug = ? WHERE id = ?",
            [title, content, cover_image_url, finalSlug, postId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Новину з таким ID не знайдено.' });
        }
        await logAdminAction(req.user.id, `Оновив новину в блозі ID ${postId}`);
        res.json({ message: 'Новину успішно оновлено' });
    } catch (error) {
        console.error("Помилка оновлення новини:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};

/**
 * Видаляє пост з блогу.
 */
exports.deleteBlogPost = async (req, res) => {
    const { postId } = req.params;
    try {
        const [result] = await (await db).query("DELETE FROM blog_posts WHERE id = ?", [postId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Новину з таким ID не знайдено.' });
        }
        await logAdminAction(req.user.id, `Видалив новину з блогу ID ${postId}`);
        res.json({ message: 'Новину успішно видалено' });
    } catch (error) {
        console.error("Помилка видалення новини:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};