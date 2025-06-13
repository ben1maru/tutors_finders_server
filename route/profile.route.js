const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { 
    getStudentDashboard, 
    saveTutor,
    unsaveTutor,
    getTutorProfileForEdit, 
    updateTutorProfile,
    getTutorReviews
} = require('../controllers/profile.controller');

router.use(protect); // Захищаємо всі маршрути

// Маршрути для учня
router.get('/student/dashboard', getStudentDashboard);
router.post('/student/saved-tutors', saveTutor); // Зберегти репетитора
router.delete('/student/saved-tutors/:tutorId', unsaveTutor); // Видалити з обраного

// Маршрути для репетитора
router.get('/tutor/profile', getTutorProfileForEdit);
router.put('/tutor/profile', updateTutorProfile);
router.get('/tutor/reviews', getTutorReviews);

module.exports = router;