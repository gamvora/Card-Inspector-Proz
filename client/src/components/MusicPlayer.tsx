import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
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
  X,
  Heart,
  Disc3
} from 'lucide-react';

interface Song {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channel: string;
}

interface MusicPlayerProps {
  onMinimize?: () => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function MusicPlayer({ onMinimize }: MusicPlayerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedSong = localStorage.getItem('currentSong');
    const savedVolume = localStorage.getItem('musicVolume');
    const savedLoop = localStorage.getItem('musicLoop');
    
    if (savedSong) {
      try {
        setCurrentSong(JSON.parse(savedSong));
      } catch (e) {}
    }
    if (savedVolume) setVolume(parseInt(savedVolume));
    if (savedLoop) setIsLooping(savedLoop === 'true');
  }, []);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        setPlayerReady(true);
      };
    } else {
      setPlayerReady(true);
    }
  }, []);

  useEffect(() => {
    if (playerReady && currentSong && !playerRef.current) {
      initPlayer(currentSong.id);
    }
  }, [playerReady, currentSong]);

  const initPlayer = (videoId: string) => {
    if (playerRef.current) {
      playerRef.current.destroy();
    }
    
    playerRef.current = new window.YT.Player('youtube-player', {
      height: '0',
      width: '0',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: (event: any) => {
          event.target.setVolume(volume);
          setDuration(event.target.getDuration());
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            startProgressTracking();
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
            stopProgressTracking();
          } else if (event.data === window.YT.PlayerState.ENDED) {
            if (isLooping) {
              event.target.seekTo(0);
              event.target.playVideo();
            } else {
              setIsPlaying(false);
              setProgress(0);
              stopProgressTracking();
            }
          }
        }
      }
    });
  };

  const startProgressTracking = () => {
    stopProgressTracking();
    progressInterval.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        setProgress(playerRef.current.getCurrentTime());
        setDuration(playerRef.current.getDuration());
      }
    }, 1000);
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
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`);
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

  const handleSelectSong = (song: Song) => {
    setCurrentSong(song);
    localStorage.setItem('currentSong', JSON.stringify(song));
    setSearchResults([]);
    setSearchQuery('');
    
    if (playerRef.current) {
      playerRef.current.loadVideoById(song.id);
      playerRef.current.playVideo();
    } else if (playerReady) {
      initPlayer(song.id);
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.playVideo();
        }
      }, 1000);
    }
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (value: number[]) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(value[0], true);
    setProgress(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    localStorage.setItem('musicVolume', newVolume.toString());
    if (playerRef.current) {
      playerRef.current.setVolume(newVolume);
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volume);
    } else {
      playerRef.current.mute();
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
    if (!playerRef.current) return;
    const newTime = Math.max(0, progress - 10);
    playerRef.current.seekTo(newTime, true);
    setProgress(newTime);
  };

  const skipForward = () => {
    if (!playerRef.current) return;
    const newTime = Math.min(duration, progress + 10);
    playerRef.current.seekTo(newTime, true);
    setProgress(newTime);
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border-purple-200 dark:border-purple-500/30 overflow-visible" data-testid="music-player">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Music Player</h3>
            <p className="text-xs text-muted-foreground">Search & Play Songs</p>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <Input
          placeholder="Search for a song..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="pr-12 rounded-xl bg-white/50 dark:bg-slate-800/50"
          data-testid="input-music-search"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSearch}
          disabled={isSearching}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg"
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
            className="mb-4 max-h-64 overflow-y-auto space-y-2 rounded-xl bg-white/30 dark:bg-slate-800/30 p-2"
          >
            {searchResults.map((song) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleSelectSong(song)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                data-testid={`song-result-${song.id}`}
              >
                <img 
                  src={song.thumbnail} 
                  alt={song.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.channel}</p>
                </div>
                <span className="text-xs text-muted-foreground">{song.duration}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {currentSong && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm">
            <motion.div 
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 3, repeat: isPlaying ? Infinity : 0, ease: "linear" }}
              className="relative"
            >
              <img 
                src={currentSong.thumbnail} 
                alt={currentSong.title}
                className="w-16 h-16 rounded-full object-cover border-4 border-white/30 shadow-lg"
              />
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500/20 to-transparent" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate">{currentSong.title}</p>
              <p className="text-sm text-muted-foreground truncate">{currentSong.channel}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Slider
              value={[progress]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              className="cursor-pointer"
              data-testid="slider-progress"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleLoop}
              className={`rounded-full ${isLooping ? 'text-purple-500 bg-purple-500/20' : ''}`}
              data-testid="button-loop"
            >
              <Repeat className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={skipBack}
              className="rounded-full"
              data-testid="button-skip-back"
            >
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button
              size="lg"
              onClick={togglePlay}
              className="rounded-full w-14 h-14 bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 border-0"
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-1" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={skipForward}
              className="rounded-full"
              data-testid="button-skip-forward"
            >
              <SkipForward className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMute}
              className="rounded-full"
              data-testid="button-mute"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-3 px-4">
            <VolumeX className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[isMuted ? 0 : volume]}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              className="flex-1"
              data-testid="slider-volume"
            />
            <Volume2 className="w-4 h-4 text-muted-foreground" />
          </div>
        </motion.div>
      )}

      {!currentSong && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Disc3 className="w-16 h-16 mb-3 opacity-30" />
          <p className="text-sm">Search for a song to start playing</p>
        </div>
      )}

      <div id="youtube-player" className="hidden" />
    </Card>
  );
}

export function MiniPlayer({ onExpand }: { onExpand?: () => void }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const savedSong = localStorage.getItem('currentSong');
    if (savedSong) {
      try {
        setCurrentSong(JSON.parse(savedSong));
      } catch (e) {}
    }
  }, []);

  if (!currentSong) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm cursor-pointer hover:from-purple-500/30 hover:to-pink-500/30 transition-colors"
      onClick={onExpand}
      data-testid="mini-player"
    >
      <motion.div
        animate={{ rotate: isPlaying ? 360 : 0 }}
        transition={{ duration: 3, repeat: isPlaying ? Infinity : 0, ease: "linear" }}
      >
        <Music className="w-4 h-4 text-purple-500" />
      </motion.div>
      <span className="text-xs font-medium max-w-24 truncate">{currentSong.title}</span>
    </motion.div>
  );
}
