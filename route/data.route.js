const express = require('express');
const router = express.Router();
const { getTutors, getTutorById, getDictionaries, getBlogPosts, getBlogPostBySlug } = require('../controllers/data.controller');

// Tutors
router.get('/tutors', getTutors);
router.get('/tutors/:id', getTutorById);

// Dictionaries
router.get('/dictionaries', getDictionaries);

// Blog
router.get('/blog', getBlogPosts);
router.get('/blog/:slug', getBlogPostBySlug);

module.exports = router;