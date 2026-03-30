import { Router } from 'express';
import channelsRouter from './channels';
import conversationsRouter from './conversations';
import commentsRouter from './comments';
import convertRouter from './convert';
import statsRouter from './stats';

const router = Router();

router.use('/channels', channelsRouter);
router.use('/conversations', conversationsRouter);
router.use('/comments', commentsRouter);
router.use('/convert', convertRouter);
router.use('/stats', statsRouter);

export default router;
