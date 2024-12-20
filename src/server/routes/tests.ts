import express, { RequestHandler } from 'express';

const router = express.Router();

const getTestPageHandler: RequestHandler = (_req, res) => {
    res.render('test', { title: 'Test Page' });
};

const postTestHandler: RequestHandler = (_req, res) => {
    res.json({ message: 'Test endpoint reached' });
};

router.get('/', getTestPageHandler);
router.post('/', postTestHandler);

export default router;
