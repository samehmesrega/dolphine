import { Router } from 'express';
import { requirePermission } from '../../../shared/middleware/auth';
import channelsRouter from './channels';
import conversationsRouter from './conversations';
import commentsRouter from './comments';
import convertRouter from './convert';
import statsRouter from './stats';

const router = Router();

router.use('/channels', requirePermission('inbox.manage'), channelsRouter);
router.use('/conversations', requirePermission('inbox.view'), conversationsRouter);
router.use('/comments', requirePermission('inbox.view'), commentsRouter);
router.use('/convert', requirePermission('inbox.convert'), convertRouter);
router.use('/stats', requirePermission('inbox.view'), statsRouter);

export default router;
