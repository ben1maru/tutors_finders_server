const jwt = require('jsonwebtoken');

// Перевіряє наявність та валідність JWT токена
const protect = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Додаємо дані користувача (id та роль) до об'єкта запиту
            req.user = { id: decoded.id, role: decoded.role };
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Не авторизовано, токен недійсний' });
        }
    }
    if (!token) {
        return res.status(401).json({ message: 'Не авторизовано, немає токена' });
    }
};

module.exports = { protect };