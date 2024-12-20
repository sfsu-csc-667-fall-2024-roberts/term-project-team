import express, { Request, Response, RequestHandler } from 'express';
import { requireAuth } from '../middleware/auth';
import { PropertyService } from '../services/propertyService';
import { AuthRequest } from '../../shared/types';

const router = express.Router();
const propertyService = PropertyService.getInstance();

// Get all properties
const getAllPropertiesHandler: RequestHandler = async (_req: Request, res: Response) => {
    try {
        const properties = await propertyService.getProperties();
        res.json(properties);
    } catch (error) {
        console.error('Error getting properties:', error);
        res.status(500).json({ error: 'Failed to get properties' });
    }
};

// Get property by ID
const getPropertyHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const propertyId = parseInt(req.params.propertyId);
        const property = await propertyService.getProperty(propertyId);
        
        if (!property) {
            res.status(404).json({ error: 'Property not found' });
            return;
        }
        
        res.json(property);
    } catch (error) {
        console.error('Error getting property:', error);
        res.status(500).json({ error: 'Failed to get property' });
    }
};

// Get properties in game
const getPropertiesInGameHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const properties = await propertyService.getPropertiesInGame(gameId);
        res.json(properties);
    } catch (error) {
        console.error('Error getting properties in game:', error);
        res.status(500).json({ error: 'Failed to get properties in game' });
    }
};

// Purchase property
const purchasePropertyHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const propertyId = parseInt(req.params.propertyId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const success = await propertyService.purchaseProperty(propertyId, userId);
        res.json({ success });
    } catch (error) {
        console.error('Error purchasing property:', error);
        res.status(500).json({ error: 'Failed to purchase property' });
    }
};

// Sell property
const sellPropertyHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const propertyId = parseInt(req.params.propertyId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const success = await propertyService.sell(propertyId, userId);
        res.json({ success });
    } catch (error) {
        console.error('Error selling property:', error);
        res.status(500).json({ error: 'Failed to sell property' });
    }
};

// Mortgage property
const mortgagePropertyHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const propertyId = parseInt(req.params.propertyId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const success = await propertyService.mortgage(propertyId, userId);
        res.json({ success });
    } catch (error) {
        console.error('Error mortgaging property:', error);
        res.status(500).json({ error: 'Failed to mortgage property' });
    }
};

// Unmortgage property
const unmortgagePropertyHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
        const propertyId = parseInt(req.params.propertyId);
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const success = await propertyService.unmortgage(propertyId, userId);
        res.json({ success });
    } catch (error) {
        console.error('Error unmortgaging property:', error);
        res.status(500).json({ error: 'Failed to unmortgage property' });
    }
};

router.get('/', getAllPropertiesHandler);
router.get('/:propertyId', getPropertyHandler);
router.get('/game/:gameId', getPropertiesInGameHandler);
router.post('/:propertyId/purchase', requireAuth, purchasePropertyHandler);
router.post('/:propertyId/sell', requireAuth, sellPropertyHandler);
router.post('/:propertyId/mortgage', requireAuth, mortgagePropertyHandler);
router.post('/:propertyId/unmortgage', requireAuth, unmortgagePropertyHandler);

export default router;