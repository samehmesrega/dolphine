import { Router } from 'express';
import creativesRouter from './creatives';
import requestsRouter from './requests';
import ideasRouter from './ideas';
import tagsRouter from './tags';
import competitorsRouter from './competitors';
import projectsRouter from './projects';
import settingsRouter from './settings';

const router = Router();

router.use('/creatives', creativesRouter);
router.use('/requests', requestsRouter);
router.use('/ideas', ideasRouter);
router.use('/tags', tagsRouter);
router.use('/competitors', competitorsRouter);
router.use('/projects', projectsRouter);
router.use('/settings', settingsRouter);

export default router;
