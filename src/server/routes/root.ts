import express, { RequestHandler } from 'express';

const router = express.Router();

const getRootHandler: RequestHandler = (_req, res) => {
    res.render('index');
};

router.get('/', getRootHandler);

export default router;
