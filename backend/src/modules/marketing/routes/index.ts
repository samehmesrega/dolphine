import { Router } from 'express';
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

router.use('/creatives', creativesRouter);
router.use('/requests', requestsRouter);
router.use('/ideas', ideasRouter);
router.use('/tags', tagsRouter);
router.use('/competitors', competitorsRouter);
router.use('/projects', projectsRouter);
router.use('/settings', settingsRouter);
router.use('/scripts', scriptsRouter);
router.use('/media-buying', mediaBuyingRouter);
router.use('/media-buying/breakdown', breakdownRouter);
router.use('/oauth', oauthRouter);
router.use('/landing-pages', landingPagesRouter);
router.use('/dashboard', dashboardRouter);
router.use('/ai-providers', aiProvidersRouter);
router.use('/order-forms', orderFormsRouter);
router.use('/', publishingRouter); // calendar, posts, social-pages, brands mounted at marketing root

export default router;
