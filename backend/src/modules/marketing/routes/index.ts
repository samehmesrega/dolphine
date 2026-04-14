import { Router } from 'express';
import { requirePermission } from '../../../shared/middleware/auth';
import creativesRouter from './creatives';
import requestsRouter from './requests';
import ideasRouter from './ideas';
import tagsRouter from './tags';
import competitorsRouter from './competitors';
import projectsRouter from './projects';
import settingsRouter from './settings';
import scriptsRouter from './scripts';
import publishingRouter from './publishing';
import mediaBuyingRouter from './media-buying';
import breakdownRouter from './breakdown';
import oauthRouter from './oauth';
import landingPagesRouter from './landing-pages';
import dashboardRouter from './dashboard';
import aiProvidersRouter from './ai-providers';
import orderFormsRouter from './order-forms';

const router = Router();

router.use('/creatives', requirePermission('marketing.creatives.view'), creativesRouter);
router.use('/requests', requirePermission('marketing.requests.view'), requestsRouter);
router.use('/ideas', requirePermission('marketing.ideas.view'), ideasRouter);
router.use('/tags', requirePermission('marketing.creatives.view'), tagsRouter);
router.use('/competitors', requirePermission('marketing.creatives.view'), competitorsRouter);
router.use('/projects', requirePermission('marketing.settings.view'), projectsRouter);
router.use('/settings', requirePermission('marketing.settings.view'), settingsRouter);
router.use('/scripts', requirePermission('marketing.creatives.view'), scriptsRouter);
router.use('/media-buying', requirePermission('marketing.media-buying.view'), mediaBuyingRouter);
router.use('/media-buying/breakdown', requirePermission('marketing.media-buying.view'), breakdownRouter);
router.use('/oauth', requirePermission('marketing.settings.manage'), oauthRouter);
router.use('/landing-pages', requirePermission('marketing.landing-pages.view'), landingPagesRouter);
router.use('/dashboard', requirePermission('marketing.creatives.view'), dashboardRouter);
router.use('/ai-providers', requirePermission('marketing.settings.manage'), aiProvidersRouter);
router.use('/order-forms', requirePermission('marketing.landing-pages.view'), orderFormsRouter);
router.use('/', requirePermission('marketing.publishing.view'), publishingRouter); // calendar, posts, social-pages, brands

export default router;
