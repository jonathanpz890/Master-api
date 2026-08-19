import { Request, Response } from 'express';
import { logger } from 'mnemonix';

// Define the mock database for offline fallback
const MOCK_MODELS = [
  {
    id: 1,
    name: '3DBenchy - The Classic Calibration Boat',
    thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300',
    creator: {
      name: 'CreativeTools',
      public_url: 'https://www.thingiverse.com/CreativeTools',
    },
    public_url: 'https://www.thingiverse.com/thing:763622',
    description:
      '3DBenchy is a 3D model designed for testing and benchmarking 3D printers. It is a small boat that tests overhangs, bridging, details, and dimensions.',
    files: [
      {
        id: 101,
        name: '3dbenchy.stl',
        download_url: '/models/3dbenchy.stl',
        size: 160532,
      },
    ],
  },
  {
    id: 2,
    name: 'Chess Pawn - Elegant Modern Design',
    thumbnail: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=300',
    creator: {
      name: 'ChessMaster',
      public_url: 'https://www.thingiverse.com/ChessMaster',
    },
    public_url: 'https://www.thingiverse.com/thing:3415201',
    description:
      'An elegant, modern style chess pawn designed to print quickly and calibrate smooth outer surfaces.',
    files: [
      {
        id: 201,
        name: 'chess_pawn.stl',
        download_url: '/models/chess_pawn.stl',
        size: 89432,
      },
    ],
  },
  {
    id: 3,
    name: 'Calibration Torus / Donut Geometry',
    thumbnail: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300',
    creator: {
      name: 'GeomMaker',
      public_url: 'https://www.thingiverse.com/GeomMaker',
    },
    public_url: 'https://www.thingiverse.com/thing:2938120',
    description:
      'A smooth torus shape perfect for checking infill densities, perimeter line quality, and standard extrusion rates.',
    files: [
      {
        id: 301,
        name: 'torus.stl',
        download_url: '/models/torus.stl',
        size: 163452,
      },
    ],
  },
  {
    id: 4,
    name: 'Ribbed Medium Vase for Spiral Mode',
    thumbnail: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300',
    creator: {
      name: 'VaseArt',
      public_url: 'https://www.thingiverse.com/VaseArt',
    },
    public_url: 'https://www.thingiverse.com/thing:4512930',
    description:
      'A beautiful ribbed vase designed for spiralize outer contour (vase mode) printing with no top infill.',
    files: [
      {
        id: 401,
        name: 'ribbed-vase-medium-size.stl',
        download_url: '/models/ribbed-vase-medium-size.stl',
        size: 245032,
      },
    ],
  },
];

// Helper to check if Thingiverse token is set
const getAuthHeader = () => {
  const token = process.env.BLUEPRINT_THINGIVERSE_API_TOKEN;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
};

// Helper to filter out Non-Commercial (NC) models
const filterCommercialModels = async (things: any[], headers: any): Promise<any[]> => {
  // We fetch details in parallel to check the license
  const promises = things.map(async (thing) => {
    try {
      const res = await fetch(`https://api.thingiverse.com/things/${thing.id}`, { headers });
      if (res.ok) {
        const detail: any = await res.json();
        const license = (detail.license || '').toLowerCase();
        // CC BY-NC, CC BY-NC-SA, etc contain "nc" or "non-commercial"
        if (
          license.includes('-nc') ||
          license.includes('non-commercial') ||
          license.includes('noncommercial')
        ) {
          return null;
        }
        return thing;
      }
    } catch (e) {
      // Ignore errors for individual items
    }
    return null;
  });

  const results = await Promise.all(promises);
  return results.filter(Boolean);
};

/**
 * GET /api/models/popular
 * Returns a list of popular models. Falls back to mocks if no token.
 */
export const getPopularModels = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const headers = getAuthHeader();

  if (!headers) {
    logger.info('Thingiverse token unavailable; returning mock popular models');
    return res.status(200).json(MOCK_MODELS);
  }

  try {
    const url = `https://api.thingiverse.com/popular?page=${page}&per_page=12`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Thingiverse API responded with status ${response.status}`);
    }

    const data = await response.json();

    // Filter out Non-Commercial models to comply with TOS
    const commercialOnly = await filterCommercialModels(data as any[], headers);

    // Map Thingiverse response to our clean client schema
    const formatted = commercialOnly.map((thing) => ({
      id: thing.id,
      name: thing.name,
      thumbnail: thing.thumbnail,
      creator: {
        name: thing.creator?.name || 'Unknown Creator',
        public_url: thing.creator?.public_url || '',
      },
      public_url: thing.public_url,
      description: thing.description || '',
    }));

    return res.status(200).json(formatted);
  } catch (error: any) {
    logger.error('Failed to fetch popular Thingiverse models', error);
    return res.status(200).json(MOCK_MODELS); // Fallback on failure
  }
};

/**
 * GET /api/models/search
 * Searches for models by query string. Falls back to mocks if no token.
 */
export const searchModels = async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const page = parseInt(req.query.page as string) || 1;
  const headers = getAuthHeader();

  if (!query) {
    return res.status(200).json([]);
  }

  if (!headers) {
    logger.info('Searching mock models', { query });
    const filtered = MOCK_MODELS.filter(
      (m) =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.description.toLowerCase().includes(query.toLowerCase()),
    );
    return res.status(200).json(filtered);
  }

  try {
    const url = `https://api.thingiverse.com/search/${encodeURIComponent(query)}?page=${page}&per_page=12`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Thingiverse API responded with status ${response.status}`);
    }

    const data = await response.json();

    const hits = (data as any).hits || data || [];

    // Filter out Non-Commercial models to comply with TOS
    const commercialOnly = await filterCommercialModels(hits as any[], headers);

    const formatted = commercialOnly.map((thing) => ({
      id: thing.id,
      name: thing.name,
      thumbnail: thing.thumbnail,
      creator: {
        name: thing.creator?.name || 'Unknown Creator',
        public_url: thing.creator?.public_url || '',
      },
      public_url: thing.public_url,
      description: thing.description || '',
    }));

    return res.status(200).json(formatted);
  } catch (error: any) {
    logger.error('Failed to search Thingiverse models', { query, error });
    // Return mock results as fallback
    const filtered = MOCK_MODELS.filter(
      (m) =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.description.toLowerCase().includes(query.toLowerCase()),
    );
    return res.status(200).json(filtered);
  }
};

/**
 * GET /api/models/files/:id
 * Fetches file listings for a specific Thing. Falls back to mocks if no token.
 */
export const getModelFiles = async (req: Request, res: Response) => {
  const thingId = parseInt(req.params.id);
  const headers = getAuthHeader();

  if (isNaN(thingId)) {
    return res.status(400).json({ error: 'Invalid model ID' });
  }

  // Check mock database first
  const mockMatch = MOCK_MODELS.find((m) => m.id === thingId);
  if (!headers || mockMatch) {
    if (mockMatch) {
      return res.status(200).json(mockMatch.files);
    }
    return res.status(404).json({ error: 'Model files not found' });
  }

  try {
    const url = `https://api.thingiverse.com/things/${thingId}/files`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Thingiverse API responded with status ${response.status}`);
    }

    const data = await response.json();
    const formatted = (data as any[]).map((file) => ({
      id: file.id,
      name: file.name,
      download_url: file.download_url,
      size: file.size,
    }));

    return res.status(200).json(formatted);
  } catch (error: any) {
    logger.error('Failed to fetch Thingiverse model files', { thingId, error });
    return res.status(404).json({ error: 'Could not retrieve model files' });
  }
};

/**
 * GET /api/models/download
 * Downloads a file from the Thingiverse CDN/API url and streams it back to the client.
 */
export const downloadModelFile = async (req: Request, res: Response) => {
  const downloadUrl = req.query.url as string;
  const headers = getAuthHeader();

  if (!downloadUrl) {
    return res.status(400).json({ error: 'Download url query parameter is required' });
  }

  let url: URL;
  try {
    url = new URL(downloadUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid download URL' });
  }
  const allowedHost =
    url.hostname === 'thingiverse.com' || url.hostname.endsWith('.thingiverse.com');
  if (url.protocol !== 'https:' || !allowedHost) {
    return res.status(400).json({ error: 'Only HTTPS Thingiverse download URLs are allowed' });
  }

  try {
    const fetchHeaders: Record<string, string> = {};
    if (url.hostname === 'api.thingiverse.com' && headers) {
      fetchHeaders['Authorization'] = headers.Authorization;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const response = await fetch(url, {
      headers: fetchHeaders,
      redirect: 'error',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote file, status ${response.status}`);
    }
    const maxBytes = 50 * 1024 * 1024;
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (contentLength > maxBytes || !response.body) {
      return res.status(413).json({ error: 'Remote model is too large' });
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return res.status(413).json({ error: 'Remote model is too large' });
      }
      chunks.push(value);
    }
    res.setHeader(
      'Content-Type',
      response.headers.get('content-type') || 'application/octet-stream',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="model.stl"');
    return res.status(200).send(Buffer.concat(chunks));
  } catch (error: any) {
    logger.error('Thingiverse model download proxy request failed', error);
    return res.status(500).json({ error: 'Failed to download model file through proxy server' });
  }
};

/**
 * GET /api/models/images/:id
 * Fetches all images for a specific Thing. Falls back to mock values if no token.
 */
export const getModelImages = async (req: Request, res: Response) => {
  const thingId = parseInt(req.params.id);
  const headers = getAuthHeader();

  if (isNaN(thingId)) {
    return res.status(400).json({ error: 'Invalid model ID' });
  }

  // Check mock database first
  const mockMatch = MOCK_MODELS.find((m) => m.id === thingId);
  if (!headers || mockMatch) {
    if (mockMatch) {
      // Return a set of mock images using different parameters
      return res.status(200).json([
        { id: 1, url: mockMatch.thumbnail },
        { id: 2, url: mockMatch.thumbnail + '&q=80&fm=jpg&crop=entropy' },
      ]);
    }
    return res.status(200).json([]);
  }

  try {
    const url = `https://api.thingiverse.com/things/${thingId}/images`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Thingiverse API responded with status ${response.status}`);
    }

    const data = await response.json();
    const formatted = (data as any[]).map((img, index) => {
      const sizes = img.sizes || [];
      // Find a large or medium image size
      const largeSize =
        sizes.find((s: any) => s.size === 'large') ||
        sizes.find((s: any) => s.size === 'medium') ||
        sizes[0];
      return {
        id: img.id || index,
        url: largeSize ? largeSize.url : img.url || '',
      };
    });

    return res.status(200).json(formatted);
  } catch (error: any) {
    logger.error('Failed to fetch Thingiverse model images', { thingId, error });
    return res.status(200).json([]);
  }
};
