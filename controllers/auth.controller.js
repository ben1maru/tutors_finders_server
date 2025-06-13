const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Реєстрація учня
exports.registerStudent = async (req, res) => {
    const { fullName, email, password } = req.body;
    try {
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'Всі поля є обов\'язковими' });
        }

        const [existing] = await (await db).query("SELECT id FROM users WHERE email = ?", [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Користувач з таким email вже існує' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await (await db).query(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'student')",
            [fullName, email, hashedPassword]
        );

        const token = generateToken(result.insertId, 'student');
        res.status(201).json({ token });

    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера', error: error.message });
    }
};

// Реєстрація репетитора
exports.registerTutor = async (req, res) => {
    // Додаємо photo_url, subjects, levels до полів, які очікуємо
    const { fullName, email, password, photo_url, description, subjects, levels, experience, education, city, format, price } = req.body;
    const connection = await db;
    try {
        // Починаємо транзакцію
        await connection.beginTransaction();

        // 1. Створюємо користувача
        const [existing] = await connection.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existing.length > 0) {
            // Важливо викидати помилку, щоб її зловив catch і зробив rollback
            throw new Error('Користувач з таким email вже існує');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.query(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'tutor')",
            [fullName, email, hashedPassword]
        );
        const userId = userResult.insertId;

        // 2. Створюємо профіль репетитора
        await connection.query(
            "INSERT INTO tutor_profiles (user_id, photo_url, description, experience_years, education, city, lesson_format, price_per_hour) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [userId, photo_url, description, experience, education, city, format, price]
        );

        // 3. Додаємо зв'язки предметів та рівнів у зв'язуючу таблицю
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

        // Якщо все пройшло добре, підтверджуємо зміни
        await connection.commit();
        res.status(201).json({ message: 'Реєстрація успішна. Ваша анкета надіслана на модерацію.' });

    } catch (error) {
        // У разі будь-якої помилки, відкочуємо всі зміни
        await connection.rollback();
        // Повертаємо помилку з відповідним статусом
        res.status(400).json({ message: error.message || 'Помилка сервера під час реєстрації.' });
    }
};
// Вхід в систему
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await (await db).query("SELECT * FROM users WHERE email = ?", [email]);
        const user = rows[0];

        if (user && (await bcrypt.compare(password, user.password_hash))) {
            if (user.is_blocked) {
                return res.status(403).json({ message: 'Ваш акаунт заблоковано адміністратором.' });
            }
            const token = generateToken(user.id, user.role);
            res.json({ token, user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role } });
        } else {
            res.status(401).json({ message: 'Неправильний email або пароль' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера', error: error.message });
    }
};

// Отримати дані поточного користувача
exports.getMe = async (req, res) => {
    try {
        const [rows] = await (await db).query("SELECT id, email, full_name, role FROM users WHERE id = ?", [req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Користувача не знайдено' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера', error: error.message });
    }
};