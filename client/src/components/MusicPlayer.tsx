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
  Disc3
} from 'lucide-react';

interface Song {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channel: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function MusicPlayer() {
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

  useEffect(() => {
    return () => {
      stopProgressTracking();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, []);

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
      const response = await authFetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`);
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
    <Card className="p-4 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border-purple-200 dark:border-purple-500/30 overflow-visible" data-testid="music-player">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
          <Music className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm">Music Player</h3>
          <p className="text-[10px] text-muted-foreground">Search & Play</p>
        </div>
      </div>

      <div className="relative mb-3">
        <Input
          placeholder="Search song..."
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
            {searchResults.map((song) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => handleSelectSong(song)}
                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-white/50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors active:scale-[0.98]"
                data-testid={`song-result-${song.id}`}
              >
                <img 
                  src={song.thumbnail} 
                  alt={song.title}
                  className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate">{song.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{song.channel}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {currentSong && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20">
            <motion.div 
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 3, repeat: isPlaying ? Infinity : 0, ease: "linear" }}
              className="flex-shrink-0"
            >
              <img 
                src={currentSong.thumbnail} 
                alt={currentSong.title}
                className="w-12 h-12 rounded-full object-cover border-2 border-white/30 shadow-md"
              />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs truncate">{currentSong.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{currentSong.channel}</p>
            </div>
          </div>

          <div className="space-y-1">
            <Slider
              value={[progress]}
              max={duration || 100}
              step={1}
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
              className={`h-8 w-8 rounded-full ${isLooping ? 'text-purple-500 bg-purple-500/20' : ''}`}
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
              className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md border-0 p-0"
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

      {!currentSong && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Disc3 className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-xs">Search for a song</p>
        </div>
      )}

      <div id="youtube-player" className="hidden" />
    </Card>
  );
}
