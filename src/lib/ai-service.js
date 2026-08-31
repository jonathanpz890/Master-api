import { logger } from './logger.js';
const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000;
const MAX_MODELS_PER_PROFILE = 4;
const modelName = (name) => name.replace(/^models\//, '').trim();
const uniqueModelNames = (names) => [...new Set(names.map(modelName).filter(Boolean))];
const supportsGenerateContent = (model) => model.supportedGenerationMethods?.includes('generateContent') ?? false;
const isAutoTextCandidate = (name) => /^gemini-\d+(?:\.\d+)?-flash(?:-lite)?$/.test(name);
const isAutoImageCandidate = (name) => /^gemini-\d+(?:\.\d+)?-flash(?:-lite)?-image$/.test(name);
const versionParts = (name) => {
    const match = name.match(/^gemini-(\d+)(?:\.(\d+))?-flash(-lite)?/);
    return [Number(match?.[1] ?? 0), Number(match?.[2] ?? 0), match?.[3] ? 0 : 1];
};
const sortNewestFirst = (models) => [...models].sort((left, right) => {
    const leftVersion = versionParts(left);
    const rightVersion = versionParts(right);
    return (rightVersion[0] - leftVersion[0] ||
        rightVersion[1] - leftVersion[1] ||
        rightVersion[2] - leftVersion[2] ||
        left.localeCompare(right));
});
/**
 * Shared server-level Gemini model resolver.
 *
 * Apps register the model family they support. The resolver asks Gemini which
 * models are actually available to that app's key at startup and every day,
 * so a retired model is skipped before it can take down a production flow.
 */
export class AIService {
    fetcher;
    now;
    refreshIntervalMs;
    profiles = new Map();
    cache = new Map();
    refreshes = new Map();
    refreshTimer;
    constructor(options = {}) {
        this.fetcher = options.fetcher ?? fetch;
        this.now = options.now ?? Date.now;
        this.refreshIntervalMs = options.refreshIntervalMs ?? DAILY_REFRESH_MS;
    }
    start() {
        if (this.refreshTimer)
            return;
        this.refreshTimer = setInterval(() => {
            void this.refreshAllGeminiModels();
        }, this.refreshIntervalMs);
        this.refreshTimer.unref();
    }
    stop() {
        if (!this.refreshTimer)
            return;
        clearInterval(this.refreshTimer);
        this.refreshTimer = undefined;
    }
    registerGeminiProfile(profile) {
        const normalizedProfile = {
            ...profile,
            preferredModels: uniqueModelNames(profile.preferredModels),
        };
        this.profiles.set(normalizedProfile.id, normalizedProfile);
    }
    async getGeminiModels(profile) {
        this.registerGeminiProfile(profile);
        const cached = this.cache.get(profile.id);
        if (cached && this.now() - cached.refreshedAt < this.refreshIntervalMs) {
            return cached.modelNames;
        }
        return this.refreshGeminiModels(profile.id);
    }
    /** Removes a retired model immediately; the next request uses the remaining set. */
    markGeminiModelUnavailable(profileId, unavailableModel) {
        const cached = this.cache.get(profileId);
        if (cached) {
            cached.modelNames = cached.modelNames.filter((model) => model !== unavailableModel);
        }
        logger.warn('Gemini model marked unavailable', { profile: profileId, model: unavailableModel });
        void this.refreshGeminiModels(profileId);
    }
    async refreshAllGeminiModels() {
        await Promise.all([...this.profiles.keys()].map((profileId) => this.refreshGeminiModels(profileId)));
    }
    async refreshGeminiModels(profileId) {
        const activeRefresh = this.refreshes.get(profileId);
        if (activeRefresh)
            return activeRefresh;
        const refresh = this.requestGeminiModels(profileId);
        this.refreshes.set(profileId, refresh);
        try {
            return await refresh;
        }
        finally {
            this.refreshes.delete(profileId);
        }
    }
    async requestGeminiModels(profileId) {
        const profile = this.profiles.get(profileId);
        if (!profile)
            return [];
        const fallbackModels = uniqueModelNames(profile.preferredModels);
        if (!profile.apiKey) {
            logger.warn('Gemini model refresh skipped because no API key is configured', { profile: profile.id });
            return this.cache.get(profile.id)?.modelNames ?? fallbackModels;
        }
        try {
            const response = await this.fetcher(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(profile.apiKey)}`);
            if (!response.ok) {
                throw new Error(`Gemini models.list returned HTTP ${response.status}`);
            }
            const payload = (await response.json());
            const availableModels = (payload.models ?? [])
                .filter(supportsGenerateContent)
                .map((model) => (model.name ? modelName(model.name) : ''))
                .filter(Boolean);
            const availableSet = new Set(availableModels);
            const discoveredModels = sortNewestFirst(availableModels.filter((name) => (profile.purpose === 'image' ? isAutoImageCandidate(name) : isAutoTextCandidate(name)) &&
                (profile.automaticModelFilter?.(name) ?? true)));
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
        }
        catch (error) {
            logger.warn('Gemini model refresh failed; retaining the last known configuration', {
                profile: profile.id,
                error,
            });
            return this.cache.get(profile.id)?.modelNames ?? fallbackModels;
        }
    }
}
export const aiService = new AIService();
//# sourceMappingURL=ai-service.js.map