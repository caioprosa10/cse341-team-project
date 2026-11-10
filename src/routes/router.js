// src/routes/router.js
import apiRoutes from './api-routes.js';
import ejsRoutes from './ejs-routes.js';
import { Router } from 'express';

const router = Router();

// JSON endpoints consumed by the pages and by Swagger.
router.use('/', apiRoutes);

// Server rendered pages.
router.use('/', ejsRoutes);

export default router;
