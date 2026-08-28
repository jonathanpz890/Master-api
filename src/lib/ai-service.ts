import { logger } from './logger.js';

const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000;
const MAX_MODELS_PER_PROFILE = 4;

export type GeminiModelPurpose = 'text' | 'image';

export interface GeminiModelProfile {
  /** Stable identifier for the app and workload using Gemini. Never include the API key. */
  id: string;
  apiKey: string;
  purpose: GeminiModelPurpose;
  /** Ordered models and aliases that the app has been verified to support. */
  preferredModels: readonly string[];
  /** Prevent models unsuitable for an app from entering its automatic fallback chain. */
  automaticModelFilter?: (model: string) => boolean;
}

interface GeminiCatalogModel {
  name?: string;
  supportedGenerationMethods?: string[];
}

interface GeminiModelCatalogResponse {
  models?: GeminiCatalogModel[];
}

interface CachedModels {
  modelNames: string[];
  refreshedAt: number;
}

interface AIServiceOptions {
  fetcher?: typeof fetch;
  now?: () => number;
  refreshIntervalMs?: number;
}

const modelName = (name: string): string => name.replace(/^models\//, '').trim();

const uniqueModelNames = (names: readonly string[]): string[] =>
  [...new Set(names.map(modelName).filter(Boolean))];

const supportsGenerateContent = (model: GeminiCatalogModel): boolean =>
  model.supportedGenerationMethods?.includes('generateContent') ?? false;

const isAutoTextCandidate = (name: string): boolean =>
  /^gemini-\d+(?:\.\d+)?-flash(?:-lite)?$/.test(name);

const isAutoImageCandidate = (name: string): boolean =>
  /^gemini-\d+(?:\.\d+)?-flash(?:-lite)?-image$/.test(name);

const versionParts = (name: string): [number, number, number] => {
  const match = name.match(/^gemini-(\d+)(?:\.(\d+))?-flash(-lite)?/);
  return [Number(match?.[1] ?? 0), Number(match?.[2] ?? 0), match?.[3] ? 0 : 1];
};

const sortNewestFirst = (models: string[]): string[] =>
  [...models].sort((left, right) => {
    const leftVersion = versionParts(left);
    const rightVersion = versionParts(right);
    return (
      rightVersion[0] - leftVersion[0] ||
      rightVersion[1] - leftVersion[1] ||
      rightVersion[2] - leftVersion[2] ||
      left.localeCompare(right)
    );
  });

/**
 * Shared server-level Gemini model resolver.
 *
 * Apps register the model family they support. The resolver asks Gemini which
 * models are actually available to that app's key at startup and every day,
 * so a retired model is skipped before it can take down a production flow.
 */
export class AIService {
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly refreshIntervalMs: number;
  private readonly profiles = new Map<string, GeminiModelProfile>();
  private readonly cache = new Map<string, CachedModels>();
  private readonly refreshes = new Map<string, Promise<readonly string[]>>();
  private refreshTimer: NodeJS.Timeout | undefined;

  constructor(options: AIServiceOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
    this.refreshIntervalMs = options.refreshIntervalMs ?? DAILY_REFRESH_MS;
  }

  start(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setInterval(() => {
      void this.refreshAllGeminiModels();
    }, this.refreshIntervalMs);
    this.refreshTimer.unref();
  }

  stop(): void {
    if (!this.refreshTimer) return;
    clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  registerGeminiProfile(profile: GeminiModelProfile): void {
    const normalizedProfile: GeminiModelProfile = {
      ...profile,
      preferredModels: uniqueModelNames(profile.preferredModels),
    };
    this.profiles.set(normalizedProfile.id, normalizedProfile);
  }

  async getGeminiModels(profile: GeminiModelProfile): Promise<readonly string[]> {
    this.registerGeminiProfile(profile);
    const cached = this.cache.get(profile.id);
    if (cached && this.now() - cached.refreshedAt < this.refreshIntervalMs) {
      return cached.modelNames;
    }
    return this.refreshGeminiModels(profile.id);
  }

  /** Removes a retired model immediately; the next request uses the remaining set. */
  markGeminiModelUnavailable(profileId: string, unavailableModel: string): void {
    const cached = this.cache.get(profileId);
    if (cached) {
      cached.modelNames = cached.modelNames.filter((model) => model !== unavailableModel);
    }
    logger.warn('Gemini model marked unavailable', { profile: profileId, model: unavailableModel });
    void this.refreshGeminiModels(profileId);
  }

  async refreshAllGeminiModels(): Promise<void> {
    await Promise.all([...this.profiles.keys()].map((profileId) => this.refreshGeminiModels(profileId)));
  }

  private async refreshGeminiModels(profileId: string): Promise<readonly string[]> {
    const activeRefresh = this.refreshes.get(profileId);
    if (activeRefresh) return activeRefresh;

    const refresh = this.requestGeminiModels(profileId);
    this.refreshes.set(profileId, refresh);
    try {
      return await refresh;
    } finally {
      this.refreshes.delete(profileId);
    }
  }

  private async requestGeminiModels(profileId: string): Promise<readonly string[]> {
    const profile = this.profiles.get(profileId);
    if (!profile) return [];

    const fallbackModels = uniqueModelNames(profile.preferredModels);
    if (!profile.apiKey) {
      logger.warn('Gemini model refresh skipped because no API key is configured', { profile: profile.id });
      return this.cache.get(profile.id)?.modelNames ?? fallbackModels;
    }

    try {
      const response = await this.fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(profile.apiKey)}`,
      );
      if (!response.ok) {
        throw new Error(`Gemini models.list returned HTTP ${response.status}`);
      }

      const payload = (await response.json()) as GeminiModelCatalogResponse;
      const availableModels = (payload.models ?? [])
        .filter(supportsGenerateContent)
        .map((model) => (model.name ? modelName(model.name) : ''))
        .filter(Boolean);
      const availableSet = new Set(availableModels);
      const discoveredModels = sortNewestFirst(
        availableModels.filter(
          (name) =>
            (profile.purpose === 'image' ? isAutoImageCandidate(name) : isAutoTextCandidate(name)) &&
            (profile.automaticModelFilter?.(name) ?? true),
        ),
      );
      const resolvedModels = uniqueModelNames([
        ...fallbackModels.filter((name) => availableSet.has(name)),
        ...discoveredModels,
      ]).slice(0, MAX_MODELS_PER_PROFILE);

      if (!resolvedModels.length) {
        throw new Error('Gemini models.list returned no compatible generateContent models');
      }

      this.cache.set(profile.id, { modelNames: resolvedModels, refreshedAt: this.now() });
      logger.info('Gemini model availability refreshed', {
        profile: profile.id,
        purpose: profile.purpose,
        models: resolvedModels,
      });
      return resolvedModels;
    } catch (error) {
      logger.warn('Gemini model refresh failed; retaining the last known configuration', {
        profile: profile.id,
        error,
      });
      return this.cache.get(profile.id)?.modelNames ?? fallbackModels;
    }
  }
}

export const aiService = new AIService();
