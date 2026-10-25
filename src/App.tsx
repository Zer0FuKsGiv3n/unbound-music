import { useEffect, useMemo, useRef, useState } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { loadFromStorage, saveToStorage } from './lib/storage';
import { fetchArtistRadioTracks, fetchSearchResults, fetchTrending, fetchPlaylistTracks, fetchSubscriptions, fetchUserPlaylists } from './lib/youtube';
import { getRecommendedTracks } from './lib/recommendations';
import { createYouTubePlayer, describeYouTubeError, YouTubePlayerStates } from './lib/youtubePlayer';
import type { YouTubePlayerInstance } from './lib/youtubePlayer';
import type { PlaylistItem, TabKey, Track } from './types';

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'search', label: 'Search', icon: '🔍' },
  { key: 'youtube', label: 'YouTube', icon: '▶️' },
  { key: 'spotify', label: 'Spotify', icon: '💚' },
  { key: 'liked', label: 'Liked', icon: '❤️' },
  { key: 'downloads', label: 'Saved', icon: '⬇️' },
  { key: 'queue', label: 'Queue', icon: '🎶' },
  { key: 'radio', label: 'Radio', icon: '📻' },
  { key: 'import', label: 'Import', icon: '📥' },
];

const defaultTrending: Track[] = [
  {
    id: 'trending-1',
    title: 'Midnight Drive',
    artist: 'Velvet Harbor',
    thumb: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80',
    source: 'youtube',
  },
  {
    id: 'trending-2',
    title: 'Neon Echoes',
    artist: 'Luna Circuit',
    thumb: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=300&q=80',
    source: 'youtube',
  },
  {
    id: 'trending-3',
    title: 'Afterglow',
    artist: 'Morning Static',
    thumb: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&q=80',
    source: 'youtube',
  },
];

function App() {
  const [location, setLocation] = useLocation();
  const activeTab: TabKey = location === '/' ? 'home' : (location.slice(1) as TabKey);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [trending, setTrending] = useState<Track[]>(defaultTrending);
  const [liked, setLiked] = useState<Track[]>(() => loadFromStorage<Track[]>('liked_songs', []));
  const [downloads, setDownloads] = useState<Track[]>(() => loadFromStorage<Track[]>('downloads', []));
  const [queue, setQueue] = useState<Track[]>(() => loadFromStorage<Track[]>('queue', []));
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [channelId, setChannelId] = useState<string>(() => loadFromStorage<string>('yt_channel_id', ''));
  const [playlists, setPlaylists] = useState<PlaylistItem[]>(() => loadFromStorage<PlaylistItem[]>('yt_playlists', []));
  const [subscriptions, setSubscriptions] = useState<Track[]>(() => loadFromStorage<Track[]>('yt_subscriptions', []));
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [externalRecommendations, setExternalRecommendations] = useState<boolean>(() => loadFromStorage<boolean>('external_recommendations', false));
  // End-of-queue rule, made explicit so Unbound can never sit in a
  // Musify-style "completed but nowhere to go" state. Repeat On (the
  // previous, silent behaviour, now visible and saved) loops the queue.
  // Repeat Off ends in one clean, visible finished state: playing stops,
  // the last track stays on screen, and Play restarts from the first
  // track. No end-of-queue step ever depends on a network fetch.
  const [repeatQueue, setRepeatQueue] = useState<boolean>(() => loadFromStorage<boolean>('repeat_queue', true));
  const [queueEnded, setQueueEnded] = useState(false);
  const consecutiveErrorsRef = useRef(0);
  const awaitingRadioRefillRef = useRef(false);
  const [recommended, setRecommended] = useState<Track[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsNote, setRecommendationsNote] = useState<string | null>(null);
  const [radioArtist, setRadioArtist] = useState('');
  const [radioSeed, setRadioSeed] = useState('');
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);
  const radioReplenishingRef = useRef(false);
  const radioLastReplenishedForRef = useRef<string | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayerInstance | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const playNextRef = useRef<() => void>(() => {});
  // The YouTube player is created once, so its callbacks would otherwise
  // keep the very first render's logic. These refs keep them current,
  // the same way playNextRef already does for track endings.
  const playbackErrorRef = useRef<(code: number) => void>(() => {});

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const changeTab = (tab: TabKey): void => {
    setLocation(tab === 'home' ? '/' : `/${tab}`);
  };

  useEffect(() => {
    void loadTrendingTracks();
  }, []);

  useEffect(() => {
    saveToStorage('liked_songs', liked);
  }, [liked]);

  useEffect(() => {
    saveToStorage('external_recommendations', externalRecommendations);
  }, [externalRecommendations]);

  useEffect(() => {
    saveToStorage('repeat_queue', repeatQueue);
  }, [repeatQueue]);

  useEffect(() => {
    saveToStorage('downloads', downloads);
  }, [downloads]);

  useEffect(() => {
    saveToStorage('queue', queue);
  }, [queue]);

  useEffect(() => {
    saveToStorage('yt_channel_id', channelId);
  }, [channelId]);

  useEffect(() => {
    saveToStorage('yt_playlists', playlists);
  }, [playlists]);

  useEffect(() => {
    saveToStorage('yt_subscriptions', subscriptions);
  }, [subscriptions]);

  // Real playback: a visible YouTube IFrame player, not just a play/pause
  // flag. The player instance persists across tracks; only the video ID
  // changes. No ads, tracking, or monetisation code is added here.
  useEffect(() => {
    if (!currentTrack || currentTrack.source !== 'youtube') {
      youtubePlayerRef.current?.stopVideo();
      if (currentTrack) {
        setPlaying(false);
      }
      return;
    }

    setPlayerError(null);
    let cancelled = false;
    const container = youtubeContainerRef.current;
    if (!container && !youtubePlayerRef.current) {
      return;
    }

    const setup = async (): Promise<void> => {
      try {
        if (youtubePlayerRef.current) {
          youtubePlayerRef.current.loadVideoById(currentTrack.id);
          return;
        }
        if (!container) {
          return;
        }
        const player = await createYouTubePlayer(container, currentTrack.id, {
          onReady: () => {
            if (!cancelled) {
              setPlayerReady(true);
            }
          },
          onStateChange: (state) => {
            if (state === YouTubePlayerStates.ENDED) {
              playNextRef.current();
            } else if (state === YouTubePlayerStates.PLAYING || state === YouTubePlayerStates.BUFFERING) {
              consecutiveErrorsRef.current = 0;
              setPlaying(true);
            } else if (state === YouTubePlayerStates.PAUSED) {
              setPlaying(false);
            }
          },
          onError: (code) => {
            playbackErrorRef.current(code);
          },
        });
        if (cancelled) {
          player.destroy();
          return;
        }
        youtubePlayerRef.current = player;
      } catch (error) {
        if (!cancelled) {
          setPlayerError(error instanceof Error ? error.message : 'Could not start YouTube playback.');
        }
      }
    };

    void setup();
    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  useEffect(() => {
    const player = youtubePlayerRef.current;
    if (!player || !playerReady || !currentTrack || currentTrack.source !== 'youtube') {
      return;
    }
    if (playing) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, [playing, playerReady, currentTrack]);

  useEffect(() => {
    return () => {
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, []);

  const loadTrendingTracks = async (): Promise<void> => {
    const results = await fetchTrending();
    if (results.length > 0) {
      setTrending(results);
    }
  };

  // The magic "if" in action: one saved switch decides which
  // recommendation engine runs. Off = Unbound's own mix from liked,
  // saved, and recent tracks, computed instantly with no network call.
  // On = YouTube-style picks scored from recently played artists.
  // It never touches search, and it never replaces the playing queue
  // until the listener taps a recommendation.
  const loadRecommendedTracks = async (): Promise<void> => {
    setRecommendationsNote(null);
    setRecommendationsLoading(true);
    try {
      const recent = queue.slice(0, 5);
      const tracks = await getRecommendedTracks({
        externalRecommendations,
        liked,
        saved: downloads,
        recent,
        excludeIds: new Set(queue.map((item) => item.id)),
      });
      setRecommended(tracks);
      if (tracks.length === 0) {
        setRecommendationsNote('Like or save a few tracks first, then recommendations will have something to build from.');
      } else if (externalRecommendations && recent.length === 0) {
        setRecommendationsNote('No recent plays yet, so this is Unbound\'s own mix for now.');
      }
    } finally {
      setRecommendationsLoading(false);
    }
  };

  // Refresh recommendations when the switch flips, not on every
  // queue change, so flipping it feels instant for the own mix and
  // deliberate for the external fetch.
  useEffect(() => {
    void loadRecommendedTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRecommendations]);

  const handleSearch = async (): Promise<void> => {
    const query = searchTerm.trim();
    if (!query) return;
    setLocation('/search');
    const results = await fetchSearchResults(query);
    setSearchResults(results);
  };

  const loadYouTubeData = async (): Promise<void> => {
    if (!channelId.trim()) return;
    const [playlistData, subscriptionData] = await Promise.all([
      fetchUserPlaylists(channelId),
      fetchSubscriptions(channelId),
    ]);
    setPlaylists(playlistData);
    setSubscriptions(subscriptionData);
  };

  const openPlaylist = async (playlistId: string, title: string): Promise<void> => {
    const tracks = await fetchPlaylistTracks(playlistId, title);
    // A playlist is not radio, so its queue must not be refilled with
    // tracks from a previous radio station when it nears its end.
    setRadioSeed('');
    setQueueEnded(false);
    setQueue(tracks);
    setLocation('/youtube');
  };

  const startRadio = async (): Promise<void> => {
    const seed = radioArtist.trim();
    if (!seed || radioLoading) return;
    setRadioError(null);
    setRadioLoading(true);
    try {
      const tracks = await fetchArtistRadioTracks(seed, new Set());
      if (tracks.length === 0) {
        setRadioError(`No tracks found for "${seed}". Try another artist spelling.`);
        return;
      }
      setRadioSeed(seed);
      radioLastReplenishedForRef.current = null;
      awaitingRadioRefillRef.current = false;
      setQueueEnded(false);
      setPlayerError(null);
      setQueue(tracks);
      setCurrentTrack(tracks[0] ?? null);
      setPlaying(true);
      setLocation('/radio');
    } finally {
      setRadioLoading(false);
    }
  };

  const toggleLike = (track: Track): void => {
    setLiked((current) => {
      const exists = current.some((item) => item.id === track.id);
      if (exists) return current.filter((item) => item.id !== track.id);
      return [track, ...current];
    });
  };

  const saveTrack = (track: Track): void => {
    setDownloads((current) => {
      const exists = current.some((item) => item.id === track.id);
      if (exists) return current;
      return [track, ...current];
    });
  };

  // One clean finished state, never a "completed but stuck" state.
  const finishQueue = (): void => {
    awaitingRadioRefillRef.current = false;
    youtubePlayerRef.current?.stopVideo();
    setPlaying(false);
    setQueueEnded(true);
  };

  const playNext = (): void => {
    if (!currentTrack || queue.length === 0) return;
    // From the finished state, Next is a restart, not another finish.
    if (queueEnded) {
      setQueueEnded(false);
      setCurrentTrack(queue[0] ?? currentTrack);
      setPlaying(true);
      return;
    }
    const currentIndex = queue.findIndex((item) => item.id === currentTrack.id);
    if (currentIndex < 0) {
      setCurrentTrack(queue[0] ?? currentTrack);
      return;
    }
    if (currentIndex < queue.length - 1) {
      setCurrentTrack(queue[currentIndex + 1] ?? currentTrack);
      return;
    }
    // Last track. Never fetch a next track here: that is exactly the
    // Musify failure mode, a background network call at the moment of
    // completion with no guaranteed answer. Radio is the one exception,
    // and only when its refill is already in flight: wait for that
    // already-started result instead of finishing or wrapping early.
    if (radioSeed && radioReplenishingRef.current) {
      awaitingRadioRefillRef.current = true;
      return;
    }
    if (repeatQueue) {
      setCurrentTrack(queue[0] ?? currentTrack);
      return;
    }
    finishQueue();
  };

  // An unplayable track must not stop the whole queue dead, the way a
  // single error stops Musify when it has nowhere to go. Skip it, but
  // count consecutive failures: if every track in the queue fails in a
  // row, stop cleanly with a message instead of looping through errors
  // forever.
  const handlePlaybackError = (code: number): void => {
    consecutiveErrorsRef.current += 1;
    if (queue.length === 0 || consecutiveErrorsRef.current >= queue.length) {
      setPlayerError('None of the tracks in this queue could be played. Pick another track to try again.');
      finishQueue();
      return;
    }
    setPlayerError(describeYouTubeError(code));
    setPlaying(true);
    playNext();
  };

  useEffect(() => {
    playNextRef.current = playNext;
    playbackErrorRef.current = handlePlaybackError;
  });

  // Artist radio replenishment: when the listener is near the end of a
  // radio queue, fetch more tracks for the same seed, excluding anything
  // already in the queue, so radio can keep going instead of stopping
  // after the first batch. Guarded so one track triggers at most one fetch.
  useEffect(() => {
    if (!radioSeed || !currentTrack || radioReplenishingRef.current) {
      return;
    }
    const currentIndex = queue.findIndex((item) => item.id === currentTrack.id);
    if (currentIndex < 0 || queue.length - currentIndex > 5) {
      return;
    }
    if (radioLastReplenishedForRef.current === currentTrack.id) {
      return;
    }
    radioReplenishingRef.current = true;
    radioLastReplenishedForRef.current = currentTrack.id;
    const replenish = async (): Promise<void> => {
      try {
        const existing = new Set(queue.map((item) => item.id));
        const more = await fetchArtistRadioTracks(radioSeed, existing);
        if (more.length > 0) {
          setQueue((current) => [...current, ...more]);
          if (awaitingRadioRefillRef.current) {
            awaitingRadioRefillRef.current = false;
            setQueueEnded(false);
            setCurrentTrack(more[0] ?? currentTrack);
            setPlaying(true);
          }
        } else if (awaitingRadioRefillRef.current) {
          // The refill that was already in flight came back empty, so
          // radio really has run out of new tracks for this artist.
          // Repeat On loops the existing queue; Repeat Off finishes
          // cleanly, instead of silently looping when the user said no.
          awaitingRadioRefillRef.current = false;
          if (repeatQueue) {
            setCurrentTrack(queue[0] ?? currentTrack);
            setPlaying(true);
          } else {
            finishQueue();
          }
        }
      } finally {
        radioReplenishingRef.current = false;
      }
    };
    void replenish();
  }, [currentTrack, queue, radioSeed]);

  const playPrevious = (): void => {
    if (!currentTrack || queue.length === 0) return;
    // From the finished state, Previous resumes the track before the
    // last one (or the only track, if there is just one), so it is
    // never a dead button on a finished queue.
    if (queueEnded) {
      setQueueEnded(false);
      setCurrentTrack(queue.length > 1 ? (queue[queue.length - 2] ?? currentTrack) : currentTrack);
      setPlaying(true);
      return;
    }
    const currentIndex = queue.findIndex((item) => item.id === currentTrack.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    setCurrentTrack(queue[prevIndex] ?? currentTrack);
  };

  const playFromList = (track: Track, list: Track[]): void => {
    // A new, non-radio queue ends the radio station: without this, the
    // old radio seed would silently refill a playlist or search queue
    // near its end. Tapping inside the current queue (including the
    // radio queue itself) keeps the seed, because that queue has not
    // actually changed.
    if (list !== queue) {
      setRadioSeed('');
    }
    awaitingRadioRefillRef.current = false;
    consecutiveErrorsRef.current = 0;
    setPlayerError(null);
    setQueueEnded(false);
    setQueue(list);
    setCurrentTrack(track);
    setPlaying(true);
  };

  // From the finished state, the main Play button restarts the queue
  // from the first track. Replaying an ended video directly would
  // leave the listener on the last track with no clear next step.
  const togglePlay = (): void => {
    if (queueEnded && queue.length > 0) {
      setQueueEnded(false);
      setCurrentTrack(queue[0] ?? currentTrack);
      setPlaying(true);
      return;
    }
    setPlaying((value) => !value);
  };

  const isLiked = (track: Track): boolean => liked.some((item) => item.id === track.id);
  const isDownloaded = (track: Track): boolean => downloads.some((item) => item.id === track.id);

  const renderTrackList = (items: Track[], listKey: string): JSX.Element => {
    if (items.length === 0) {
      return (
        <div className="empty-state">
          <div className="emoji">🎵</div>
          <p>No tracks here yet.</p>
        </div>
      );
    }

    return (
      <div className="track-list">
        {items.map((track) => (
          <div key={`${listKey}-${track.id}`} className={`track-row ${currentTrack?.id === track.id ? 'active' : ''}`}>
            <img src={track.thumb} alt={track.title} className="track-thumb" />
            <div className="track-copy" onClick={() => playFromList(track, items)}>
              <div className="track-title">{track.title}</div>
              <div className="track-artist">{track.artist}</div>
            </div>
            <div className="track-actions">
              <button type="button" className="mini-button" onClick={() => toggleLike(track)} aria-label="Toggle like">
                {isLiked(track) ? '❤️' : '🤍'}
              </button>
              <button type="button" className="mini-button" onClick={() => saveTrack(track)} aria-label="Save track">
                {isDownloaded(track) ? '✅' : '⬇️'}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">Unbound Music</div>
          <div className="greeting">{greeting}</div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-button" onClick={() => setLocation('/search')}>🔍</button>
          <button type="button" className="icon-button" onClick={() => setLocation('/import')}>📥</button>
        </div>
      </header>

      <nav className="tab-strip" aria-label="Main navigation">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => changeTab(tab.key)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="content-area">
        <Switch>
          <Route path="/">
            <section className="panel">
              <div className="section-header">
                <h2>🔥 Trending</h2>
                <button type="button" className="link-button" onClick={() => void loadTrendingTracks()}>Refresh</button>
              </div>
              {renderTrackList(trending, 'trending')}
            </section>

            <section className="panel">
              <div className="section-header">
                <h2>✨ Recommended for you</h2>
                <button type="button" className="link-button" onClick={() => void loadRecommendedTracks()} disabled={recommendationsLoading}>
                  {recommendationsLoading ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              <div className="import-card">
                <button
                  type="button"
                  className="primary-button"
                  aria-pressed={externalRecommendations}
                  onClick={() => setExternalRecommendations((value) => !value)}
                >
                  External recommendations: {externalRecommendations ? 'On' : 'Off'}
                </button>
                <p>
                  {externalRecommendations
                    ? 'On: YouTube-style picks, scored from what you played recently.'
                    : 'Off: Unbound\'s own mix, from your liked, saved, and recent tracks.'}
                  {' '}Search is not affected by this switch, and your queue only changes if you tap a recommendation.
                </p>
                {recommendationsNote ? <p>{recommendationsNote}</p> : null}
              </div>
              <div className="spacer" />
              {recommended.length > 0 ? renderTrackList(recommended, 'recommended') : null}
            </section>

            <section className="panel">
              <h2>🕐 Recently Played</h2>
              {renderTrackList(queue.slice(0, 5), 'recent')}
            </section>
          </Route>

          <Route path="/search">
            <section className="panel">
              <div className="search-box">
                <input
                  type="search"
                  value={searchTerm}
                  placeholder="Search songs or artists"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleSearch();
                    }
                  }}
                />
                <button type="button" className="primary-button" onClick={() => void handleSearch()}>Search</button>
              </div>
              {searchResults.length > 0 ? renderTrackList(searchResults, 'search-results') : <div className="empty-state"><div className="emoji">🔎</div><p>Search for your next obsession.</p></div>}
            </section>
          </Route>

          <Route path="/youtube">
            <section className="panel">
              <div className="section-header">
                <h2>📼 Saved playlists</h2>
                <button type="button" className="link-button" onClick={() => void loadYouTubeData()}>Refresh</button>
              </div>
              {playlists.length > 0 ? (
                <div className="chip-list">
                  {playlists.map((playlist) => (
                    <button key={playlist.id} type="button" className="chip" onClick={() => void openPlaylist(playlist.id, playlist.title)}>
                      {playlist.title}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><div className="emoji">📋</div><p>Import a channel ID to load playlists.</p></div>
              )}
              <div className="spacer" />
              <h2>📡 Subscriptions</h2>
              {subscriptions.length > 0 ? renderTrackList(subscriptions, 'subscriptions') : <div className="empty-state"><div className="emoji">📡</div><p>Nothing imported yet.</p></div>}
            </section>
          </Route>

          <Route path="/spotify">
            <section className="panel">
              <div className="spotify-card">
                <div className="emoji large">💚</div>
                <h2>Spotify import</h2>
                <p>Upload your YourLibrary.json export to build a local music library with no login required.</p>
                <button type="button" className="primary-button wide">Upload JSON</button>
              </div>
            </section>
          </Route>

          <Route path="/liked">
            <section className="panel">
              <h2>❤️ Liked Songs</h2>
              {renderTrackList(liked, 'liked')}
            </section>
          </Route>

          <Route path="/downloads">
            <section className="panel">
              <h2>⬇️ Saved</h2>
              {renderTrackList(downloads, 'downloads')}
            </section>
          </Route>

          <Route path="/queue">
            <section className="panel">
              <div className="section-header">
                <h2>🎶 Up next</h2>
                <button type="button" className="link-button" aria-pressed={repeatQueue} onClick={() => setRepeatQueue((value) => !value)}>
                  Repeat: {repeatQueue ? 'On' : 'Off'}
                </button>
                <button type="button" className="link-button" onClick={() => { setQueue([]); setQueueEnded(false); }}>Clear</button>
              </div>
              {queueEnded ? <p>Queue finished. Tap ▶ to play it again from the start, or pick another track.</p> : null}
              {renderTrackList(queue, 'queue')}
            </section>
          </Route>

          <Route path="/radio">
            <section className="panel">
              <h2>📻 Artist Radio</h2>
              <div className="import-card">
                <label htmlFor="radio-input">Artist</label>
                <input
                  id="radio-input"
                  value={radioArtist}
                  onChange={(event) => setRadioArtist(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void startRadio();
                    }
                  }}
                  placeholder="e.g. Fleetwood Mac"
                />
                <button type="button" className="primary-button" onClick={() => void startRadio()} disabled={radioLoading}>
                  {radioLoading ? 'Starting radio…' : 'Start Radio'}
                </button>
                <p>
                  Simulated radio, not official YouTube Radio: a continuous, shuffled queue
                  built from YouTube search for this artist, replenished as it plays.
                  No downloads, no ad stripping — playback is the visible YouTube player.
                </p>
                {radioError ? <p>{radioError}</p> : null}
                {radioSeed ? <p>Now playing radio for: {radioSeed}</p> : null}
              </div>
              <div className="spacer" />
              <h2>Up next on this station</h2>
              {renderTrackList(queue, 'radio')}
            </section>
          </Route>

          <Route path="/import">
            <section className="panel">
              <h2>📥 Import</h2>
              <div className="import-card">
                <label htmlFor="channel-input">YouTube Channel ID</label>
                <input
                  id="channel-input"
                  value={channelId}
                  onChange={(event) => setChannelId(event.target.value)}
                  placeholder="UCxxxxxxxxxxxxxxxxxx"
                />
                <button type="button" className="primary-button" onClick={() => void loadYouTubeData()}>Load YouTube data</button>
              </div>

              <div className="import-card">
                <h3>Spotify library</h3>
                <p>Drop your YourLibrary.json export from spotify.com/account/privacy.</p>
                <button type="button" className="primary-button wide">Upload YourLibrary.json</button>
              </div>
            </section>
          </Route>
        </Switch>
      </main>

      <div className={`now-playing-video ${currentTrack?.source === 'youtube' ? 'visible' : ''}`}>
        <div ref={youtubeContainerRef} className="youtube-player" />
        {playerError ? <div className="player-error">{playerError}</div> : queueEnded ? (
          <div className="player-error">
            {radioSeed ? `Radio ran out of new tracks for ${radioSeed}. Tap ▶ to play this queue again from the start.` : 'Queue finished. Tap ▶ to play it again from the start.'}
          </div>
        ) : null}
      </div>

      <div className={`player-bar ${currentTrack ? 'visible' : ''}`} onClick={() => setLocation('/queue')}>
        <img src={currentTrack?.thumb ?? ''} alt={currentTrack?.title ?? 'Track art'} className="player-art" />
        <div className="player-copy">
          <div className="player-title">{currentTrack?.title ?? 'Nothing playing'}</div>
          <div className="player-artist">{currentTrack?.artist ?? 'Choose a track'}</div>
        </div>
        <div className="player-actions">
          <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); playPrevious(); }}>⏮</button>
          <button
            type="button"
            className="mini-button"
            aria-pressed={repeatQueue}
            title={repeatQueue ? 'Repeat queue: On — the queue loops at the end' : 'Repeat queue: Off — the queue finishes cleanly at the end'}
            onClick={(event) => { event.stopPropagation(); setRepeatQueue((value) => !value); }}
          >
            ↻
          </button>
          <button type="button" className="mini-button primary" onClick={(event) => { event.stopPropagation(); togglePlay(); }}>
            {playing ? '⏸' : '▶'}
          </button>
          <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); playNext(); }}>⏭</button>
        </div>
      </div>
    </div>
  );
}

export default App;
