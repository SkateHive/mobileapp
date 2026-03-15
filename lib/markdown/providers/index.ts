import { Registry } from './Registry';
import { OdyseeProvider } from './OdyseeProvider';
import { IPFSProvider } from './IPFSProvider';
import { ThreeSpeakProvider } from './ThreeSpeakProvider';
import { YouTubeProvider } from './YouTubeProvider';
import { VimeoProvider } from './VimeoProvider';
import { ImageProvider } from './ImageProvider';

// Register all modular providers
Registry.register(OdyseeProvider);
Registry.register(IPFSProvider);
Registry.register(ThreeSpeakProvider);
Registry.register(YouTubeProvider);
Registry.register(VimeoProvider);
Registry.register(ImageProvider);

export { Registry };
