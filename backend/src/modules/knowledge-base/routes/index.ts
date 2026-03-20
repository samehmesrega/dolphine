import { Router } from 'express';
import productsRouter from './products';
import mediaRouter from './media';
import suppliersRouter from './suppliers';
import manufacturingRouter from './manufacturing';
import pricingRouter from './pricing';
import variationsRouter from './variations';
import marketingRouter from './marketing';
import faqsRouter from './faqs';
import objectionsRouter from './objections';
import upsellsRouter from './upsells';
import afterSalesRouter from './after-sales';
import salesScriptsRouter from './sales-scripts';

const router = Router();

// Products CRUD + search
router.use('/products', productsRouter);

// Sub-resources nested under a product
router.use('/products/:productId/media', mediaRouter);
router.use('/products/:productId/suppliers', suppliersRouter);
router.use('/products/:productId/manufacturing', manufacturingRouter);
router.use('/products/:productId/pricing', pricingRouter);
router.use('/products/:productId/variations', variationsRouter);
router.use('/products/:productId/marketing', marketingRouter);
router.use('/products/:productId/faqs', faqsRouter);
router.use('/products/:productId/objections', objectionsRouter);
router.use('/products/:productId/upsells', upsellsRouter);
router.use('/products/:productId/after-sales', afterSalesRouter);
router.use('/products/:productId/sales-scripts', salesScriptsRouter);

export default router;
