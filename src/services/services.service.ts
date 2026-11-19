import { firestoreDataClient } from './firebaseDataClient';
import type { PlatformCategory, PlatformId, SmmService } from '../types';

export const catalogService = {
  getPlatforms: (): Promise<PlatformCategory[]> => firestoreDataClient.getPlatforms(),
  getAllServices: (): Promise<SmmService[]> => firestoreDataClient.getServices(),
  getServicesByPlatform: async (platformId: PlatformId): Promise<SmmService[]> => {
    const all = await firestoreDataClient.getServices();
    return platformId === 'more' ? all : all.filter((item) => item.categoryId === platformId);
  },
};
