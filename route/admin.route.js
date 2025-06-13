const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { admin } = require('../middleware/admin.middleware');
const { 
    getDashboardStats, getAllUsers, toggleUserBlock, 
    getTutorsForAdmin, moderateTutor,
    getReviewsForAdmin, // <-- Оновлено
    deleteReview,       // <-- Оновлено
    createBlogPost, updateBlogPost, deleteBlogPost
} = require('../controllers/admin.controller');

router.use(protect, admin);

// Dashboard
router.get('/stats', getDashboardStats);

// Users
router.get('/users', getAllUsers);
router.patch('/users/:userId/block', toggleUserBlock);

// Tutors moderation
router.get('/tutors', getTutorsForAdmin);
router.patch('/tutors/:tutorId/moderate', moderateTutor);

// Reviews moderation (ОНОВЛЕНІ МАРШРУТИ)
router.get('/reviews', getReviewsForAdmin);
router.delete('/reviews/:reviewId', deleteReview);

// Blog management
router.post('/blog', createBlogPost);
router.put('/blog/:postId', updateBlogPost);
router.delete('/blog/:postId', deleteBlogPost);

module.exports = router;