import { logger } from './logger.js';

/** Services that need a database connection before their own routes accept traffic. */
export const requiredServices = ['print3dHub', 'bynder'] as const;

export type ServiceName = (typeof requiredServices)[number];
export type ServiceState = 'starting' | 'ready' | 'failed';

interface ServiceHealth {
  state: ServiceState;
  error?: string;
}

export interface Readiness {
  ready: boolean;
  services: Record<ServiceName, ServiceHealth>;
}

const services: Record<ServiceName, ServiceHealth> = {
  print3dHub: { state: 'starting' },
  bynder: { state: 'starting' },
};

const connectionChecks = new Map<ServiceName, () => boolean>();

export const getReadiness = (): Readiness => {
  const serviceHealth = structuredClone(services);
  for (const service of requiredServices) {
    const isConnected = connectionChecks.get(service);
    if (serviceHealth[service].state === 'ready' && isConnected && !isConnected()) {
      serviceHealth[service] = { state: 'failed', error: 'Database connection is not ready' };
    }
  }
  return {
    ready: requiredServices.every((service) => serviceHealth[service].state === 'ready'),
    services: serviceHealth,
  };
};

const updateService = (service: ServiceName, state: ServiceState, error?: string): void => {
  services[service] = error ? { state, error } : { state };
};

const initializeService = async (
  service: ServiceName,
  initializer: () => Promise<void>,
): Promise<void> => {
  updateService(service, 'starting');
  try {
    await initializer();
    updateService(service, 'ready');
  } catch (error) {
    updateService(
      service,
      'failed',
      error instanceof Error ? error.message : 'Unknown initialization error',
    );
    logger.error('Service database initialization failed', { service, error });
    throw error;
  }
};

/** Connect every required database during server startup and retain per-service status. */
export const initializeRequiredServices = async (): Promise<Readiness> => {
  const initializers: Record<ServiceName, () => Promise<void>> = {
    print3dHub: async () => {
      const modulePath = '../services/print3d-hub/router.js';
      const service = (await import(modulePath)) as {
        initializePrint3dHub: () => Promise<void>;
        isPrint3dHubConnected: () => boolean;
      };
      connectionChecks.set('print3dHub', service.isPrint3dHubConnected);
      await service.initializePrint3dHub();
    },
    bynder: async () => {
      const modulePath = '../services/bynder/router.js';
      const service = (await import(modulePath)) as {
        initializeBynder: () => Promise<void>;
        isBynderConnected: () => boolean;
      };
      connectionChecks.set('bynder', service.isBynderConnected);
      await service.initializeBynder();

      // Session storage and Passport used to be initialized by the first user
      // request. Warm them with Bynder's own startup without delaying other
      // services or the HTTP listener.
      const routerModulePath = '../routes/bynder.router.js';
      const router = (await import(routerModulePath)) as {
        initializeBynderRouter: () => Promise<unknown>;
      };
      await router.initializeBynderRouter();
    },
  };
  await Promise.allSettled([
    initializeService('print3dHub', initializers.print3dHub),
    initializeService('bynder', initializers.bynder),
  ]);

  const readiness = getReadiness();
  return readiness;
};
