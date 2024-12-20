//manifest file for routes in index.ts (see 11/4 recording, 14:00)

import express, { RequestHandler } from 'express';

const router = express.Router();

const getManifestHandler: RequestHandler = (_req, res) => {
    res.json({ version: '1.0.0' });
};

router.get('/', getManifestHandler);

export default router;