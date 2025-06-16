const express = require('express');
const router = express.Router();
const wordController = require('../controllers/wordController');

router.get('/words', wordController.getAllWords);
router.post('/save-word', wordController.createWord);
router.post('/migrate-words', wordController.migrateWordsFromJson);
module.exports = router;