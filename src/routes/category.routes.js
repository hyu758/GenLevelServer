const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

router.get('/categories', categoryController.getAllCategories);
router.post('/save-category', categoryController.createCategory);
router.get('/categories/:id', categoryController.getCategoryById);
router.post('/migrate-categories', categoryController.migrateCategoriesFromJson);
module.exports = router;