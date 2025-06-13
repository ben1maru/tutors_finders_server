const express = require('express');
const router = express.Router();
const { registerStudent, registerTutor, login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/register-student', registerStudent);
router.post('/register-tutor', registerTutor);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;