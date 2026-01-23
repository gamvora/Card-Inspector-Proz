import { useState, useEffect, useRef } from 'react';
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
  Music,
  Disc3,
  ExternalLink
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
  previewUrl: string | null;
  externalUrl: string;
}

export function MusicPlayer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(30); // Spotify previews are 30 seconds
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    // Create audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume / 100;
      
      audioRef.current.addEventListener('ended', () => {
        if (isLooping && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        } else {
          setIsPlaying(false);
          setProgress(0);
          stopProgressTracking();
        }
      });
      
      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration);
        }
      });
    }

    return () => {
      stopProgressTracking();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  const startProgressTracking = () => {
    stopProgressTracking();
    progressInterval.current = setInterval(() => {
      if (audioRef.current) {
        setProgress(audioRef.current.currentTime);
      }
    }, 100);
  };

  const stopProgressTracking = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
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

  const handleSelectTrack = (track: SpotifyTrack) => {
    setCurrentTrack(track);
    localStorage.setItem('currentSpotifyTrack', JSON.stringify(track));
    setSearchResults([]);
    setSearchQuery('');
    
    if (track.previewUrl && audioRef.current) {
      audioRef.current.src = track.previewUrl;
      audioRef.current.load();
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        startProgressTracking();
      }).catch(e => {
        console.error('Playback failed:', e);
      });
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack?.previewUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopProgressTracking();
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        startProgressTracking();
      }).catch(e => console.error('Play failed:', e));
    }
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setProgress(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    localStorage.setItem('musicVolume', newVolume.toString());
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume / 100;
    } else {
      audioRef.current.volume = 0;
    }
    setIsMuted(!isMuted);
  };

  const toggleLoop = () => {
    const newLoop = !isLooping;
    setIsLooping(newLoop);
    localStorage.setItem('musicLoop', newLoop.toString());
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const skipBack = () => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, audioRef.current.currentTime - 5);
    audioRef.current.currentTime = newTime;
    setProgress(newTime);
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    const newTime = Math.min(duration, audioRef.current.currentTime + 5);
    audioRef.current.currentTime = newTime;
    setProgress(newTime);
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
          <p className="text-[10px] text-muted-foreground">Premium Connected</p>
        </div>
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
                className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors active:scale-[0.98] ${
                  track.previewUrl 
                    ? 'hover:bg-white/50 dark:hover:bg-slate-700/50' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
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

      {currentTrack && (
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

          {currentTrack.previewUrl ? (
            <>
              <div className="space-y-1">
                <Slider
                  value={[progress]}
                  max={duration || 30}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                  data-testid="slider-progress"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
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
            </>
          ) : (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground mb-2">Preview not available</p>
              <Button
                size="sm"
                onClick={openInSpotify}
                className="bg-[#1DB954] hover:bg-[#1ed760] text-white text-xs"
              >
                <SiSpotify className="w-3 h-3 mr-1" />
                Open in Spotify
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {!currentTrack && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Disc3 className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-xs">Search for music on Spotify</p>
        </div>
      )}
    </Card>
  );
}
