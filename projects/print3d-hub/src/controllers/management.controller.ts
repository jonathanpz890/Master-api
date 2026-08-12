import { Request, Response } from 'express';
import { DBService } from '../services/db.service';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { deleteSliceJob, getSliceJob } from '../services/slice-job.service';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const requiredEnvironment = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured`);
  return value;
};

export const validateAuthConfiguration = (): void => {
  requiredEnvironment('ADMIN_USER');
  requiredEnvironment('ADMIN_PASS');
  requiredEnvironment('ADMIN_SESSION_SECRET');
};

const signSession = (payload: string): string => createHmac('sha256', requiredEnvironment('ADMIN_SESSION_SECRET')).update(payload).digest('base64url');

const issueSession = (): string => {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS, nonce: randomBytes(16).toString('base64url') })).toString('base64url');
  return `${payload}.${signSession(payload)}`;
};

const isValidSession = (token: string): boolean => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = signSession(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp > Date.now();
  } catch { return false; }
};

const constantTimeEquals = (left: string, right: string): boolean => {
  const leftHash = createHmac('sha256', 'password-comparison').update(left).digest();
  const rightHash = createHmac('sha256', 'password-comparison').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
};

// Authentication middleware check helper
export const checkAuth = (req: Request, res: Response, next: () => void): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token || !isValidSession(token)) {
    res.status(401).json({ error: 'Unauthorized admin access' });
    return;
  }
  next();
};

export const loginAdminController = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  const adminUser = requiredEnvironment('ADMIN_USER');
  const adminPass = requiredEnvironment('ADMIN_PASS');

  if (typeof username === 'string' && typeof password === 'string' && constantTimeEquals(username, adminUser) && constantTimeEquals(password, adminPass)) {
    res.status(200).json({
      success: true,
      token: issueSession()
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid administrator credentials'
    });
  }
};

// Orders controllers
export const getOrdersController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const orders = await DBService.getOrders();
    res.status(200).json({ success: true, data: orders });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch orders', message: error.message });
  }
};

export const addOrderController = async (req: Request, res: Response): Promise<void> => {
  const { customer, models, thingiverseUrl, thingiverseName } = req.body;

  if (!customer || !customer.name || !customer.email || !models || !Array.isArray(models) || models.length === 0) {
    res.status(400).json({ error: 'Invalid order request payload' });
    return;
  }

  if (typeof customer.name !== 'string' || customer.name.length > 120 || typeof customer.email !== 'string' || customer.email.length > 254 || !/^\S+@\S+\.\S+$/.test(customer.email)) {
    res.status(400).json({ error: 'Invalid customer details' });
    return;
  }

  const rates: Record<string, { rate: number; density: number }> = {
    PLA: { rate: 0.18, density: 1.24 }, PETG: { rate: 0.18, density: 1.27 }, TPU: { rate: 0.26, density: 1.21 }
  };
  const authoritativeModels = models.map((model: any) => {
    const job = getSliceJob(model?.fileKey);
    const material = typeof model?.material === 'string' ? model.material.toUpperCase() : '';
    const quantity = Number(model?.quantity);
    if (!job || !rates[material] || !Number.isInteger(quantity) || quantity < 1 || quantity > 100 || job.material !== material || job.fileKey !== model.fileKey) return null;
    const costs = rates[material];
    const unitPrice = 7 + job.weightg * (costs.rate / costs.density) + (job.timeSeconds / 3600) * 0.9;
    return {
      name: typeof model.name === 'string' ? model.name.slice(0, 255) : 'Untitled model',
      size: Number.isFinite(Number(model.size)) ? Number(model.size) : 0,
      material, color: typeof model.color === 'string' && /^#[0-9a-f]{6}$/i.test(model.color) ? model.color : '#111827',
      infill: job.infillDensity, layerHeight: job.layerHeight, quantity, weightg: job.weightg,
      timeSeconds: job.timeSeconds, price: Number((unitPrice * quantity).toFixed(2)), fileKey: job.fileKey
    };
  });
  if (authoritativeModels.some((model: any) => model === null)) {
    res.status(400).json({ error: 'Each order model must reference a recent completed slice job' });
    return;
  }
  const subtotal = Number(authoritativeModels.reduce((sum: number, model: any) => sum + model.price, 0).toFixed(2));
  const vatAmount = Number((subtotal * 0.17).toFixed(2));
  const totalWithVat = Number((subtotal + vatAmount).toFixed(2));

  try {
    const newOrder = await DBService.addOrder({
      customer,
      models: authoritativeModels,
      subtotal, vatAmount, totalWithVat,
      thingiverseUrl: thingiverseUrl || '',
      thingiverseName: thingiverseName || ''
    } as any);
    authoritativeModels.forEach((model: any) => deleteSliceJob(model.fileKey));
    res.status(201).json({ success: true, data: newOrder });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save order', message: error.message });
  }
};

export const updateOrderStatusController = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'slicing', 'printing', 'completed', 'shipped'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status: must be one of ${validStatuses.join(', ')}` });
    return;
  }

  try {
    const updated = await DBService.updateOrderStatus(id, status as any);
    if (!updated) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update order status', message: error.message });
  }
};

// Filaments controllers
export const getFilamentsController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const filaments = await DBService.getFilaments();
    res.status(200).json({ success: true, data: filaments });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch filaments', message: error.message });
  }
};

export const updateFilamentController = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { material, nameEn, nameHe, hex, stock, active, isDefault } = req.body;

  if (material !== undefined) {
    if (!Array.isArray(material) || material.length === 0) {
      res.status(400).json({ error: 'Material must be a non-empty array of strings' });
      return;
    }
    const validMaterials = ['PLA', 'PETG', 'TPU'];
    if (material.some((m: any) => !validMaterials.includes(m))) {
      res.status(400).json({ error: 'Invalid material type. Supported values are PLA, PETG, TPU' });
      return;
    }
  }

  try {
    const updated = await DBService.updateFilament(id, {
      ...(material !== undefined && { material }),
      ...(nameEn !== undefined && { nameEn }),
      ...(nameHe !== undefined && { nameHe }),
      ...(hex !== undefined && { hex }),
      ...(stock !== undefined && { stock: Boolean(stock) }),
      ...(active !== undefined && { active: Boolean(active) }),
      ...(isDefault !== undefined && { isDefault: Boolean(isDefault) })
    });
    if (!updated) {
      res.status(404).json({ error: 'Filament color not found' });
      return;
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update filament', message: error.message });
  }
};

export const addFilamentController = async (req: Request, res: Response): Promise<void> => {
  const { material, nameEn, nameHe, hex, stock, active, isDefault } = req.body;

  if (!material || !Array.isArray(material) || material.length === 0 || !nameEn || !nameHe || !hex) {
    res.status(400).json({ error: 'Material array, English name, Hebrew name, and Hex color are required' });
    return;
  }

  const validMaterials = ['PLA', 'PETG', 'TPU'];
  if (material.some((m: any) => !validMaterials.includes(m))) {
    res.status(400).json({ error: 'Invalid material type. Supported values are PLA, PETG, TPU' });
    return;
  }

  try {
    const newFilament = await DBService.addFilament({
      material,
      nameEn,
      nameHe,
      hex,
      stock: stock !== undefined ? Boolean(stock) : true,
      active: active !== undefined ? Boolean(active) : true,
      isDefault: isDefault !== undefined ? Boolean(isDefault) : false
    });
    res.status(201).json({ success: true, data: newFilament });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add filament color', message: error.message });
  }
};

export const deleteFilamentController = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const success = await DBService.deleteFilament(id);
    if (!success) {
      res.status(404).json({ error: 'Filament color not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Filament color deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete filament color', message: error.message });
  }
};

// Gallery controllers
export const getGalleryController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const gallery = await DBService.getGallery();
    res.status(200).json({ success: true, data: gallery });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch showcase items', message: error.message });
  }
};

export const addGalleryItemController = async (req: Request, res: Response): Promise<void> => {
  const { titleEn, titleHe, descEn, descHe, material, layerHeight, infill, weight, time, imageUrl, category } = req.body;

  if (!titleEn || !titleHe || !category) {
    res.status(400).json({ error: 'Title and category are required' });
    return;
  }

  try {
    const newItem = await DBService.addGalleryItem({
      titleEn, titleHe, descEn, descHe, material, layerHeight, infill, weight, time, imageUrl, category
    });
    res.status(201).json({ success: true, data: newItem });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add showcase item', message: error.message });
  }
};

export const updateGalleryItemController = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { titleEn, titleHe, descEn, descHe, material, layerHeight, infill, weight, time, imageUrl, category } = req.body;

  try {
    const updated = await DBService.updateGalleryItem(id, {
      ...(titleEn !== undefined && { titleEn }),
      ...(titleHe !== undefined && { titleHe }),
      ...(descEn !== undefined && { descEn }),
      ...(descHe !== undefined && { descHe }),
      ...(material !== undefined && { material }),
      ...(layerHeight !== undefined && { layerHeight }),
      ...(infill !== undefined && { infill }),
      ...(weight !== undefined && { weight }),
      ...(time !== undefined && { time }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(category !== undefined && { category })
    });
    if (!updated) {
      res.status(404).json({ error: 'Showcase item not found' });
      return;
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update showcase item', message: error.message });
  }
};

export const deleteGalleryItemController = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const success = await DBService.deleteGalleryItem(id);
    if (!success) {
      res.status(404).json({ error: 'Showcase item not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Showcase item deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete showcase item', message: error.message });
  }
};

export const uploadImageController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }
    
    // Construct public URL
    const configuredBaseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
    const fileUrl = `${configuredBaseUrl || `${req.protocol}://${req.get('host')}`}/images/${req.file.filename}`;
    
    res.status(200).json({
      success: true,
      url: fileUrl
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to upload image', message: error.message });
  }
};

export const downloadOrderModelController = async (req: Request, res: Response): Promise<void> => {
  const filePath = await DBService.getOrderModelFile(req.params.id, req.params.fileKey);
  if (!filePath) {
    res.status(404).json({ error: 'Model file not found' });
    return;
  }
  res.setHeader('Content-Type', 'application/sla');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.fileKey}"`);
  res.sendFile(filePath);
};

// ======================= Products =======================

const normalizeSlug = (value: string): string => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const getProductsController = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ success: true, data: await DBService.getProducts(true) });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch products', message: error.message });
  }
};

export const getAdminProductsController = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ success: true, data: await DBService.getProducts() });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch products', message: error.message });
  }
};

export const getProductController = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await DBService.getProductBySlug(req.params.slug);
    if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
    res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch product', message: error.message });
  }
};

export const addProductController = async (req: Request, res: Response): Promise<void> => {
  const { nameEn, nameHe, descriptionEn = '', descriptionHe = '', categoryEn = 'Organization', categoryHe = 'ארגון', imageUrl = '', active = true, sortOrder = 0 } = req.body;
  const slug = normalizeSlug(typeof req.body.slug === 'string' && req.body.slug ? req.body.slug : nameEn || '');
  if (typeof nameEn !== 'string' || !nameEn.trim() || typeof nameHe !== 'string' || !nameHe.trim() || !slug) {
    res.status(400).json({ error: 'English name, Hebrew name, and a valid slug are required' }); return;
  }
  try {
    const product = await DBService.addProduct({ slug, nameEn: nameEn.trim(), nameHe: nameHe.trim(), descriptionEn, descriptionHe, categoryEn, categoryHe, imageUrl, active: Boolean(active), sortOrder: Number(sortOrder) || 0 });
    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    const status = error?.code === 11000 ? 409 : 500;
    res.status(status).json({ error: status === 409 ? 'A product with this slug already exists' : 'Failed to add product', message: error.message });
  }
};

export const updateProductController = async (req: Request, res: Response): Promise<void> => {
  const updates: Record<string, unknown> = {};
  for (const key of ['nameEn', 'nameHe', 'descriptionEn', 'descriptionHe', 'categoryEn', 'categoryHe', 'imageUrl', 'active', 'sortOrder'] as const) {
    if (req.body[key] !== undefined) updates[key] = key === 'active' ? Boolean(req.body[key]) : key === 'sortOrder' ? Number(req.body[key]) || 0 : req.body[key];
  }
  if (req.body.slug !== undefined) {
    const slug = normalizeSlug(String(req.body.slug));
    if (!slug) { res.status(400).json({ error: 'Invalid product slug' }); return; }
    updates.slug = slug;
  }
  try {
    const product = await DBService.updateProduct(req.params.id, updates as any);
    if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
    res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    const status = error?.code === 11000 ? 409 : 500;
    res.status(status).json({ error: status === 409 ? 'A product with this slug already exists' : 'Failed to update product', message: error.message });
  }
};

export const deleteProductController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!await DBService.deleteProduct(req.params.id)) { res.status(404).json({ error: 'Product not found' }); return; }
    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete product', message: error.message });
  }
};

// ======================= Modeling Requests =======================

export const getModelingRequestsController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const requests = await DBService.getModelingRequests();
    res.status(200).json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch modeling requests', message: error.message });
  }
};

export const addModelingRequestController = async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, projectName, description, dimensions, notes } = req.body;
  if (!name || !email || !projectName || !description) {
    res.status(400).json({ error: 'Missing required fields: name, email, projectName, description' });
    return;
  }
  try {
    const newRequest = await DBService.addModelingRequest({ name, email, phone: phone || '', projectName, description, dimensions: dimensions || '', notes: notes || '' });
    res.status(201).json({ success: true, data: newRequest });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save modeling request', message: error.message });
  }
};

export const updateModelingRequestStatusController = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['new', 'reviewing', 'quoted', 'in_progress', 'completed'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status: must be one of ${validStatuses.join(', ')}` });
    return;
  }
  try {
    const updated = await DBService.updateModelingRequestStatus(id, status as any);
    if (!updated) {
      res.status(404).json({ error: 'Modeling request not found' });
      return;
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update modeling request status', message: error.message });
  }
};

// ======================= Analytics =======================

export const trackEventController = async (req: Request, res: Response): Promise<void> => {
  const { eventType, sessionId, page, language, payload } = req.body;

  const validTypes = [
    'page_view', 'quote_started', 'quote_priced', 'quote_abandoned',
    'quote_ordered', 'explore_model_opened', 'modeling_request_submitted', 'contact_form_submitted'
  ];

  if (!eventType || !validTypes.includes(eventType) || typeof sessionId !== 'string' || sessionId.length > 128 || (page !== undefined && (typeof page !== 'string' || page.length > 200)) || (language !== undefined && (typeof language !== 'string' || language.length > 16)) || (payload !== undefined && (typeof payload !== 'object' || Array.isArray(payload) || JSON.stringify(payload).length > 10_000))) {
    res.status(400).json({ error: 'Invalid analytics event payload' });
    return;
  }

  try {
    await DBService.trackEvent({ eventType, sessionId, page: page || '', language: language || 'en', payload: payload || {} });
    res.status(200).json({ success: true });
  } catch (error: any) {
    // Silently succeed on analytics errors — don't break the client
    res.status(200).json({ success: false, warning: 'Event not stored' });
  }
};

export const getAnalyticsController = async (req: Request, res: Response): Promise<void> => {
  const requestedDays = Number.parseInt(req.query.days as string, 10);
  const days = Number.isInteger(requestedDays) ? requestedDays : 30;
  if (days < 1 || days > 365) {
    res.status(400).json({ error: 'days must be between 1 and 365' });
    return;
  }
  try {
    const summary = await DBService.getAnalyticsSummary(days);
    res.status(200).json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch analytics', message: error.message });
  }
};
