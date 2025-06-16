const express = require('express');
const router = express.Router();
const levelController = require('../controllers/levelController');

router.get('/levels', levelController.getAllLevels);
router.post('/save-level', levelController.createLevel);
router.get('/levels/:id', levelController.getLevelById);
router.get('/max-level-id', levelController.getMaxLevelId);
router.get('/levelsorder', levelController.getLevelsOrder);
module.exports = router;