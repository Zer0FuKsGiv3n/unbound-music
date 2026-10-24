/**
 * Minimal, dependency-free wrapper around the YouTube IFrame Player API.
 *
 * No npm package is added: the API is loaded from youtube.com at runtime,
 * which keeps this in line with the project's "no new libraries" rule.
 * The player is rendered visibly (see App.tsx) rather than hidden, so
 * playback is an actual YouTube embed, not a silent state toggle.
 */

export type YouTubePlayerState = -1 | 0 | 1 | 2 | 3 | 5;

export const YouTubePlayerStates = {
  UNSTARTED: -1 as YouTubePlayerState,
  ENDED: 0 as YouTubePlayerState,
  PLAYING: 1 as YouTubePlayerState,
  PAUSED: 2 as YouTubePlayerState,
  BUFFERING: 3 as YouTubePlayerState,
  CUED: 5 as YouTubePlayerState,
} as const;

export interface YouTubePlayerInstance {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  destroy(): void;
}

interface YouTubePlayerEvent {
  data: number;
  target: YouTubePlayerInstance;
}

interface YouTubePlayerOptions {
  height: string;
  width: string;
  videoId?: string;
  playerVars?: Record<string, number>;
  events?: {
    onReady?: (event: YouTubePlayerEvent) => void;
    onStateChange?: (event: YouTubePlayerEvent) => void;
    onError?: (event: YouTubePlayerEvent) => void;
  };
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayerInstance;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

export function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube player requires a browser window'));
  }
  if (window.YT?.Player) {
    return Promise.resolve();
  }
  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise<void>((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };

    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('Failed to load the YouTube IFrame API'));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

export async function createYouTubePlayer(
  element: HTMLElement,
  videoId: string,
  callbacks: {
    onReady?: () => void;
    onStateChange?: (state: YouTubePlayerState) => void;
    onError?: (code: number) => void;
  },
): Promise<YouTubePlayerInstance> {
  await loadYouTubeIframeApi();
  if (!window.YT?.Player) {
    throw new Error('YouTube IFrame API loaded but YT.Player is unavailable');
  }

  return new window.YT.Player(element, {
    height: '100%',
    width: '100%',
    videoId,
    playerVars: {
      playsinline: 1,
      rel: 0,
    },
    events: {
      onReady: () => {
        callbacks.onReady?.();
      },
      onStateChange: (event) => {
        callbacks.onStateChange?.(event.data as YouTubePlayerState);
      },
      onError: (event) => {
        callbacks.onError?.(event.data);
      },
    },
  });
}

export function describeYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return 'This video ID is invalid.';
    case 5:
      return 'This video cannot be played in an HTML5 player here.';
    case 100:
      return 'This video was not found or is private.';
    case 101:
    case 150:
      return 'The owner of this video does not allow it to be embedded.';
    default:
      return `YouTube reported an error (${code}).`;
  }
}
