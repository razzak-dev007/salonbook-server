/**
 * services.ts — Salon Services Management Routes
 * Implements public catalog browsing, search by service name, category filtering,
 * price sorting, single service view, and admin CRUD with role protection.
 */

import { Router, Request, Response } from 'express';
import { dbService } from '../db.js';
import { AuthenticatedRequest, verifyToken, requireAdmin } from '../middleware/auth.js';
import { Service, ServiceStatus } from '../types.js';

const router = Router();

/**
 * GET /api/services
 * Public: Browse active salon services with search, category filter, and price sorting
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, category, sort } = req.query;

    // Fetch active services
    let services = await dbService.services.find({ status: 'active' });

    // 1. Search by Service Name (Challenge Requirement)
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      services = services.filter(
        s =>
          s.serviceName.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }

    // 2. Category Filter
    if (category && typeof category === 'string' && category.trim() !== '' && category !== 'All') {
      services = services.filter(
        s => s.category.toLowerCase() === category.toLowerCase()
      );
    }

    // 3. Sorting by Service Price (Challenge Requirement)
    if (sort === 'price-asc') {
      services.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
      services.sort((a, b) => b.price - a.price);
    } else {
      // Default: newly created first
      services.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    res.json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve salon services.' });
  }
});

/**
 * GET /api/services/featured
 * Public: Returns at least 6 active featured services for the Homepage
 */
router.get('/featured', async (_req: Request, res: Response) => {
  try {
    const active = await dbService.services.find({ status: 'active' });
    const featured = active.slice(0, 6);
    res.json({
      success: true,
      count: featured.length,
      data: featured,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch featured services.' });
  }
});

/**
 * GET /api/services/categories
 * Public: Returns distinct service categories with item counts
 */
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const active = await dbService.services.find({ status: 'active' });
    const categoryMap: { [cat: string]: number } = {};

    active.forEach(s => {
      categoryMap[s.category] = (categoryMap[s.category] || 0) + 1;
    });

    const categories = Object.keys(categoryMap).map(category => ({
      category,
      count: categoryMap[category],
    }));

    res.json({
      success: true,
      data: categories,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
});

/**
 * GET /api/services/admin/all
 * Admin: View all services (both active and inactive)
 */
router.get('/admin/all', verifyToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const allServices = await dbService.services.find();
    res.json({
      success: true,
      count: allServices.length,
      data: allServices,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch all services for administrator.' });
  }
});

/**
 * GET /api/services/:id
 * Protected: Service Details Page (verifies authentication)
 * Rules: Invalid service IDs should show an appropriate error message
 */
router.get('/:id', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const service = await dbService.services.findOne({ _id: id });

    if (!service) {
      res.status(404).json({
        success: false,
        message: 'The requested salon service was not found or has been removed.',
      });
      return;
    }

    res.json({
      success: true,
      data: service,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve service details.' });
  }
});

/**
 * POST /api/services
 * Admin: Add new salon service
 * Validates: positive price, positive duration, required fields
 */
router.post('/', verifyToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serviceName, category, description, price, duration, image, status } = req.body;

    if (!serviceName || !category || !description || price === undefined || duration === undefined) {
      res.status(400).json({
        success: false,
        message: 'Service Name, Category, Description, Price, and Duration are required.',
      });
      return;
    }

    const numPrice = Number(price);
    const numDuration = Number(duration);

    if (isNaN(numPrice) || numPrice <= 0) {
      res.status(400).json({
        success: false,
        message: 'Price must be a valid positive number.',
      });
      return;
    }

    if (isNaN(numDuration) || numDuration <= 0) {
      res.status(400).json({
        success: false,
        message: 'Duration must be a valid positive number in minutes.',
      });
      return;
    }

    const newService = await dbService.services.insertOne({
      serviceName: serviceName.trim(),
      category: category.trim(),
      description: description.trim(),
      price: numPrice,
      duration: numDuration,
      image: image?.trim() || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
      status: (status === 'inactive' ? 'inactive' : 'active') as ServiceStatus,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: 'Salon service added successfully!',
      data: newService,
    });
  } catch (err: any) {
    console.error('Add Service Error:', err);
    res.status(500).json({ success: false, message: 'Failed to create new salon service.' });
  }
});

/**
 * PUT /api/services/:id
 * Admin: Update service information
 */
router.put('/:id', verifyToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { serviceName, category, description, price, duration, image, status } = req.body;

    const existing = await dbService.services.findOne({ _id: id });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Service not found.' });
      return;
    }

    const updates: Partial<Service> = {};
    if (serviceName) updates.serviceName = serviceName.trim();
    if (category) updates.category = category.trim();
    if (description) updates.description = description.trim();
    if (image) updates.image = image.trim();
    if (status && (status === 'active' || status === 'inactive')) updates.status = status;

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice <= 0) {
        res.status(400).json({ success: false, message: 'Price must be a positive number.' });
        return;
      }
      updates.price = numPrice;
    }

    if (duration !== undefined) {
      const numDuration = Number(duration);
      if (isNaN(numDuration) || numDuration <= 0) {
        res.status(400).json({ success: false, message: 'Duration must be a positive number in minutes.' });
        return;
      }
      updates.duration = numDuration;
    }

    await dbService.services.updateOne(id, updates);
    const updated = await dbService.services.findOne({ _id: id });

    res.json({
      success: true,
      message: 'Salon service updated successfully!',
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update salon service.' });
  }
});

/**
 * PATCH /api/services/:id/status
 * Admin: Activate or Deactivate service
 */
router.patch('/:id/status', verifyToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== 'active' && status !== 'inactive') {
      res.status(400).json({ success: false, message: 'Status must be either active or inactive.' });
      return;
    }

    const existing = await dbService.services.findOne({ _id: id });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Service not found.' });
      return;
    }

    await dbService.services.updateOne(id, { status });

    res.json({
      success: true,
      message: `Service status updated to ${status}.`,
      status,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update service status.' });
  }
});

/**
 * DELETE /api/services/:id
 * Admin: Delete service
 */
router.delete('/:id', verifyToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await dbService.services.deleteOne(id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Service not found.' });
      return;
    }

    res.json({
      success: true,
      message: 'Salon service deleted successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to delete service.' });
  }
});

export default router;
