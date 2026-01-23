import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { authFetch } from '@/lib/auth';
import { 
  Search, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Repeat, 
  Loader2,
  Disc3,
  ExternalLink,
  Wifi,
  WifiOff
} from 'lucide-react';
import { SiSpotify } from 'react-icons/si';

interface SpotifyTrack {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  duration: string;
  durationMs?: number;
  previewUrl: string | null;
  externalUrl: string;
}

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

export function MusicPlayer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Load saved settings
  useEffect(() => {
    const savedTrack = localStorage.getItem('currentSpotifyTrack');
    const savedVolume = localStorage.getItem('musicVolume');
    const savedLoop = localStorage.getItem('musicLoop');
    
    if (savedTrack) {
      try {
        setCurrentTrack(JSON.parse(savedTrack));
      } catch (e) {}
    }
    if (savedVolume) setVolume(parseInt(savedVolume));
    if (savedLoop) setIsLooping(savedLoop === 'true');
  }, []);

  // Get Spotify access token
  const getAccessToken = useCallback(async () => {
    try {
      const response = await authFetch('/api/spotify/token');
      const data = await response.json();
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        return data.accessToken;
      }
    } catch (error) {
      console.error('Failed to get Spotify token:', error);
    }
    return null;
  }, []);

  // Initialize Spotify Web Playback SDK
  const initializePlayer = useCallback(async () => {
    if (!accessToken || playerRef.current) return;

    setIsConnecting(true);

    // Load Spotify SDK script if not loaded
    if (!window.Spotify) {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);

      await new Promise<void>((resolve) => {
        window.onSpotifyWebPlaybackSDKReady = () => resolve();
      });
    }

    const player = new window.Spotify.Player({
      name: 'NexusChecker Music',
      getOAuthToken: (cb: (token: string) => void) => {
        cb(accessToken);
      },
      volume: volume / 100
    });

    player.addListener('ready', ({ device_id }: { device_id: string }) => {
      console.log('[Spotify] Player ready with device ID:', device_id);
      setDeviceId(device_id);
      setIsConnected(true);
      setIsConnecting(false);
    });

    player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('[Spotify] Device went offline:', device_id);
      setIsConnected(false);
    });

    player.addListener('player_state_changed', (state: any) => {
      if (!state) return;
      
      setIsPlaying(!state.paused);
      setProgress(state.position);
      setDuration(state.duration);
      
      if (state.track_window?.current_track) {
        const track = state.track_window.current_track;
        setCurrentTrack({
          id: track.id,
          uri: track.uri,
          title: track.name,
          artist: track.artists.map((a: any) => a.name).join(', '),
          album: track.album.name,
          thumbnail: track.album.images[0]?.url || '',
          duration: formatDuration(state.duration),
          durationMs: state.duration,
          previewUrl: null,
          externalUrl: `https://open.spotify.com/track/${track.id}`
        });
      }
    });

    player.addListener('initialization_error', ({ message }: { message: string }) => {
      console.error('[Spotify] Init error:', message);
      setIsConnecting(false);
    });

    player.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('[Spotify] Auth error:', message);
      setIsConnecting(false);
      setAccessToken(null);
    });

    player.addListener('account_error', ({ message }: { message: string }) => {
      console.error('[Spotify] Account error:', message);
      setIsConnecting(false);
    });

    const connected = await player.connect();
    if (connected) {
      playerRef.current = player;
    } else {
      setIsConnecting(false);
    }
  }, [accessToken, volume]);

  // Connect to Spotify
  const connectSpotify = async () => {
    const token = await getAccessToken();
    if (token) {
      await initializePlayer();
    }
  };

  // Initialize when token is available
  useEffect(() => {
    if (accessToken && !playerRef.current) {
      initializePlayer();
    }
  }, [accessToken, initializePlayer]);

  // Progress tracking
  useEffect(() => {
    if (isPlaying && isConnected) {
      progressInterval.current = setInterval(async () => {
        if (playerRef.current) {
          const state = await playerRef.current.getCurrentState();
          if (state) {
            setProgress(state.position);
          }
        }
      }, 1000);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPlaying, isConnected]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, []);

  const formatDuration = (ms: number): string => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await authFetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.results) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectTrack = async (track: SpotifyTrack) => {
    if (!isConnected || !deviceId) {
      // Try to connect first
      await connectSpotify();
      return;
    }

    try {
      await authFetch('/api/spotify/play', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uri: track.uri,
          deviceId: deviceId
        })
      });
      
      setCurrentTrack(track);
      localStorage.setItem('currentSpotifyTrack', JSON.stringify(track));
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  };

  const togglePlay = async () => {
    if (!playerRef.current) return;
    await playerRef.current.togglePlay();
  };

  const handleSeek = async (value: number[]) => {
    if (!playerRef.current) return;
    await playerRef.current.seek(value[0]);
    setProgress(value[0]);
  };

  const handleVolumeChange = async (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    localStorage.setItem('musicVolume', newVolume.toString());
    if (playerRef.current) {
      await playerRef.current.setVolume(newVolume / 100);
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = async () => {
    if (!playerRef.current) return;
    if (isMuted) {
      await playerRef.current.setVolume(volume / 100);
    } else {
      await playerRef.current.setVolume(0);
    }
    setIsMuted(!isMuted);
  };

  const toggleLoop = () => {
    const newLoop = !isLooping;
    setIsLooping(newLoop);
    localStorage.setItem('musicLoop', newLoop.toString());
    // Note: Loop functionality would need Spotify API call
  };

  const skipBack = async () => {
    if (!playerRef.current) return;
    await playerRef.current.previousTrack();
  };

  const skipForward = async () => {
    if (!playerRef.current) return;
    await playerRef.current.nextTrack();
  };

  const openInSpotify = () => {
    if (currentTrack?.externalUrl) {
      window.open(currentTrack.externalUrl, '_blank');
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-green-500/10 via-green-600/10 to-black/10 border-green-200 dark:border-green-500/30 overflow-visible" data-testid="music-player">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[#1DB954] flex items-center justify-center flex-shrink-0">
          <SiSpotify className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm">Spotify Player</h3>
          <div className="flex items-center gap-1">
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3 text-green-500" />
                <p className="text-[10px] text-green-500">Connected</p>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground">Not connected</p>
              </>
            )}
          </div>
        </div>
        {!isConnected && (
          <Button
            size="sm"
            onClick={connectSpotify}
            disabled={isConnecting}
            className="bg-[#1DB954] hover:bg-[#1ed760] text-white text-xs h-7"
          >
            {isConnecting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              'Connect'
            )}
          </Button>
        )}
      </div>

      <div className="relative mb-3">
        <Input
          placeholder="Search Spotify..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="pr-10 h-9 text-sm rounded-lg bg-white/50 dark:bg-slate-800/50"
          data-testid="input-music-search"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSearch}
          disabled={isSearching}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md"
          data-testid="button-music-search"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 max-h-48 overflow-y-auto space-y-1.5 rounded-lg bg-white/30 dark:bg-slate-800/30 p-1.5"
          >
            {searchResults.map((track) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => handleSelectTrack(track)}
                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-white/50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors active:scale-[0.98]"
                data-testid={`song-result-${track.id}`}
              >
                <img 
                  src={track.thumbnail} 
                  alt={track.title}
                  className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate">{track.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{track.duration}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {currentTrack && isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-green-500/20 to-green-600/20">
            <motion.div 
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 3, repeat: isPlaying ? Infinity : 0, ease: "linear" }}
              className="flex-shrink-0"
            >
              <img 
                src={currentTrack.thumbnail} 
                alt={currentTrack.title}
                className="w-12 h-12 rounded-full object-cover border-2 border-white/30 shadow-md"
              />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs truncate">{currentTrack.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{currentTrack.artist}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={openInSpotify}
              className="h-7 w-7 rounded-full text-[#1DB954]"
              data-testid="button-open-spotify"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="space-y-1">
            <Slider
              value={[progress]}
              max={duration || 1}
              step={1000}
              onValueChange={handleSeek}
              className="cursor-pointer"
              data-testid="slider-progress"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
              <span>{formatDuration(progress)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleLoop}
              className={`h-8 w-8 rounded-full ${isLooping ? 'text-green-500 bg-green-500/20' : ''}`}
              data-testid="button-loop"
            >
              <Repeat className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={skipBack}
              className="h-8 w-8 rounded-full"
              data-testid="button-skip-back"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              size="default"
              onClick={togglePlay}
              className="h-10 w-10 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-white shadow-md border-0 p-0"
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={skipForward}
              className="h-8 w-8 rounded-full"
              data-testid="button-skip-forward"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMute}
              className="h-8 w-8 rounded-full"
              data-testid="button-mute"
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2 px-2">
            <VolumeX className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[isMuted ? 0 : volume]}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              className="flex-1"
              data-testid="slider-volume"
            />
            <Volume2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          </div>
        </motion.div>
      )}

      {!isConnected && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Disc3 className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-xs mb-2">Connect to play full songs</p>
          <Button
            size="sm"
            onClick={connectSpotify}
            disabled={isConnecting}
            className="bg-[#1DB954] hover:bg-[#1ed760] text-white"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <SiSpotify className="w-3 h-3 mr-1" />
                Connect Spotify
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
