const db = require('../db');

// Отримати список репетиторів з фільтрами та сортуванням
exports.getTutors = async (req, res) => {
    try {
        const { city, subject, level, format, minPrice, maxPrice, sortBy, order = 'DESC' } = req.query;
        let params = [];
        let sql = `
            SELECT u.id, u.full_name, p.photo_url, p.description, p.price_per_hour, p.average_rating, p.city, p.lesson_format, p.experience_years
            FROM users u
            JOIN tutor_profiles p ON u.id = p.user_id
            WHERE p.status = 'approved' AND u.is_blocked = false
        `;

        if (city) { sql += ` AND p.city = ?`; params.push(city); }
        if (format) { sql += ` AND (p.lesson_format = ? OR p.lesson_format = 'both')`; params.push(format); }
        if (minPrice) { sql += ` AND p.price_per_hour >= ?`; params.push(minPrice); }
        if (maxPrice) { sql += ` AND p.price_per_hour <= ?`; params.push(maxPrice); }

        if (subject || level) {
            sql += ` AND u.id IN (SELECT tsl.tutor_user_id FROM tutor_subjects_levels tsl WHERE 1=1`;
            if (subject) { sql += ` AND tsl.subject_id = ?`; params.push(subject); }
            if (level) { sql += ` AND tsl.level_id = ?`; params.push(level); }
            sql += `)`;
        }
        
        const validSorts = { rating: 'p.average_rating', experience: 'p.experience_years', price: 'p.price_per_hour' };
        const sortColumn = validSorts[sortBy] || 'p.average_rating';
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        sql += ` ORDER BY ${sortColumn} ${sortOrder}`;

        const [tutors] = await (await db).query(sql, params);
        res.json(tutors);

    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера', error: error.message });
    }
};


exports.getBlogPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const connection = await db;

        // Отримуємо пости
        const [posts] = await connection.query(
            `SELECT 
                id, 
                title, 
                slug, 
                IFNULL(cover_image_url, '') AS cover_image_url,
                LEFT(content, 200) AS excerpt,
                created_at
             FROM blog_posts
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        // Перевіряємо загальну кількість постів
        const [[{ total }]] = await connection.query(
            "SELECT COUNT(*) AS total FROM blog_posts"
        );

        // Формуємо абсолютні URL і нормалізовані об'єкти
        const baseUrl = process.env.BASE_URL || '';
        const formattedPosts = posts.map(post => ({
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            created_at: post.created_at,
            cover_image_url: post.cover_image_url 
                ? `${baseUrl}${post.cover_image_url}` 
                : null // або вкажи шлях до зображення за замовчуванням
        }));

        // Надсилаємо відповідь
        res.json({
            success: true,
            posts: formattedPosts,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                itemsPerPage: limit
            }
        });

    } catch (error) {
        console.error("Помилка при отриманні постів:", error);
        res.status(500).json({ 
            success: false,
            message: 'Помилка сервера' 
        });
    }
};


        
        
// Отримати повний профіль одного репетитора
exports.getTutorById = async (req, res) => {
    const { id } = req.params;
    const connection = await db;

    try {
        // 1. Отримуємо основні дані профілю
        const [tutorRows] = await connection.query(`
            SELECT u.id, u.full_name, u.email, p.*
            FROM users u
            JOIN tutor_profiles p ON u.id = p.user_id
            WHERE u.id = ? AND p.status = 'approved' AND u.is_blocked = false`,
            [id]
        );
        
        if (tutorRows.length === 0) {
            return res.status(404).json({ message: 'Репетитора не знайдено або анкета не схвалена' });
        }
        const tutor = tutorRows[0];

        // 2. Окремим запитом отримуємо УНІКАЛЬНІ предмети
        const [subjects] = await connection.query(`
            SELECT DISTINCT s.id, s.name FROM subjects s
            JOIN tutor_subjects_levels tsl ON s.id = tsl.subject_id
            WHERE tsl.tutor_user_id = ?`,
            [id]
        );

        // 3. Окремим запитом отримуємо УНІКАЛЬНІ рівні
        const [levels] = await connection.query(`
            SELECT DISTINCT l.id, l.name FROM levels l
            JOIN tutor_subjects_levels tsl ON l.id = tsl.level_id
            WHERE tsl.tutor_user_id = ?`,
            [id]
        );

        // 4. Окремим запитом отримуємо відгуки
        const [reviews] = await connection.query(`
            SELECT r.*, u.full_name as student_name FROM reviews r
            LEFT JOIN users u ON r.student_user_id = u.id
            WHERE r.tutor_user_id = ? AND r.status = 'approved'
            ORDER BY r.created_at DESC`,
            [id]
        );

        // 5. Оновлюємо лічильник переглядів
        await connection.query("UPDATE tutor_profiles SET views_count = views_count + 1 WHERE user_id = ?", [id]);

        // 6. Збираємо все в один об'єкт і відправляємо
        res.json({
            ...tutor,
            subjects, // Це буде масив унікальних об'єктів
            levels,   // Це буде масив унікальних об'єктів
            reviews
        });

    } catch (error) {
        console.error("Помилка завантаження профілю репетитора:", error);
        res.status(500).json({ message: 'Помилка сервера' });
    }
};
// Отримати довідники (предмети, рівні, міста)
exports.getDictionaries = async (req, res) => {
    try {
        const [subjects] = await (await db).query("SELECT * FROM subjects ORDER BY name ASC");
        const [levels] = await (await db).query("SELECT * FROM levels ORDER BY name ASC");
        const [cities] = await (await db).query("SELECT DISTINCT city FROM tutor_profiles WHERE status='approved' AND city IS NOT NULL ORDER BY city ASC");
        res.json({ subjects, levels, cities: cities.map(c => c.city) });
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера', error: error.message });
    }
};



// Отримати один пост з блогу по slug
exports.getBlogPostBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const [rows] = await (await db).query("SELECT p.*, u.full_name as author_name FROM blog_posts p LEFT JOIN users u ON p.admin_user_id = u.id WHERE p.slug = ?", [slug]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Новину не знайдено' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера', error: error.message });
    }
};