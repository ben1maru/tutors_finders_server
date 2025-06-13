// src/server/route/user.route.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');

// Існуючі контролери
const { leaveReview } = require('../controllers/interaction.controller');
const { getConversations, getMessages } = require('../controllers/user.controller');
// Новий контролер
const { findOrCreateConversation } = require('../controllers/chat.controller');

router.use(protect);

// Існуючі маршрути...
router.post('/reviews', leaveReview);
router.get('/chat/conversations', getConversations);
router.get('/chat/conversations/:conversationId/messages', getMessages);

// НОВИЙ МАРШРУТ
router.post('/chat/conversations/findOrCreate', findOrCreateConversation);

module.exports = router;