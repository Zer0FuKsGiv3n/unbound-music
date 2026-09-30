export type TabKey = 'home' | 'search' | 'youtube' | 'spotify' | 'liked' | 'downloads' | 'queue' | 'import';

export type Track = {
  id: string;
  title: string;
  artist: string;
  thumb: string;
  source: 'youtube' | 'spotify' | 'local';
};

export type PlaylistItem = {
  id: string;
  title: string;
  itemCount?: number;
};
