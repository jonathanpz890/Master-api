import express from 'express';
import * as AchievementServices from '../services/AchievementServices.js';

const router = express.Router();

router.get('/', AchievementServices.getAchievements);
router.post('/', AchievementServices.createAchievement);
router.put('/:id', AchievementServices.updateAchievement);
router.delete('/:id', AchievementServices.deleteAchievement);
router.patch('/:id/steps/:stepId/toggle', AchievementServices.toggleStep);

export default router;
