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

interface Song {
  id: string;
  title: string;
  artist: string;
  channel: string;
  thumbnail: string;
  duration: string;
  previewUrl?: string;
  deezerId?: number;
}

export function MusicPlayer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(30);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedSong = localStorage.getItem('currentDeezerSong');
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

      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          setProgress(audioRef.current.currentTime);
        }
      });
    }

    return () => {
      stopProgressTracking();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

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
      const response = await authFetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`);
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
    localStorage.setItem('currentDeezerSong', JSON.stringify(song));
    setSearchResults([]);
    setSearchQuery('');
    
    if (song.previewUrl && audioRef.current) {
      audioRef.current.src = song.previewUrl;
      audioRef.current.load();
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(e => {
        console.error('Playback failed:', e);
      });
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentSong?.previewUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
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

  const openInDeezer = () => {
    if (currentSong?.deezerId) {
      window.open(`https://www.deezer.com/track/${currentSong.deezerId}`, '_blank');
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border-purple-200 dark:border-purple-500/30 overflow-visible" data-testid="music-player">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
          <Music className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm">Music Player</h3>
          <p className="text-[10px] text-muted-foreground">Powered by Deezer</p>
        </div>
      </div>

      <div className="relative mb-3">
        <Input
          placeholder="Search any song..."
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
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"><circle cx="12" cy="12" r="10"/></svg>';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate">{song.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{song.artist || song.channel}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{song.duration}</span>
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
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"><circle cx="12" cy="12" r="10"/></svg>';
                }}
              />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs truncate">{currentSong.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{currentSong.artist || currentSong.channel}</p>
            </div>
            {currentSong.deezerId && (
              <Button
                size="icon"
                variant="ghost"
                onClick={openInDeezer}
                className="h-7 w-7 rounded-full"
                data-testid="button-open-deezer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {currentSong.previewUrl ? (
            <>
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground bg-purple-500/10 px-2 py-0.5 rounded-full">
                  30s Preview
                </span>
              </div>
              
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

              <Button
                variant="outline"
                size="sm"
                onClick={openInDeezer}
                className="w-full text-xs"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Full Song on Deezer
              </Button>
            </>
          ) : (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground mb-2">Preview not available</p>
              <Button
                size="sm"
                onClick={openInDeezer}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Listen on Deezer
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {!currentSong && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Disc3 className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-xs">Search for any song</p>
        </div>
      )}
    </Card>
  );
}
