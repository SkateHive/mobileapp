import { MediaProvider } from './BaseProvider';

class ProviderRegistry {
  private providers: Map<string, MediaProvider> = new Map();

  register(provider: MediaProvider) {
    this.providers.set(provider.name.toUpperCase(), provider);
  }

  getProvider(name: string): MediaProvider | undefined {
    return this.providers.get(name.toUpperCase());
  }

  getAllProviders(): MediaProvider[] {
    return Array.from(this.providers.values());
  }
}

export const Registry = new ProviderRegistry();
