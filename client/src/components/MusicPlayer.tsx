import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { authFetch } from '@/lib/auth';
import { getRandomSongs, LibrarySong } from '@/lib/musicLibrary';
import { 
  Search, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Repeat,
  Shuffle,
  Loader2,
  Music,
  Disc3,
  ExternalLink,
  List,
  X
} from 'lucide-react';

interface DeezerTrack {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  previewUrl: string;
  deezerId: number;
}

declare global {
  interface Window {
    globalAudio: HTMLAudioElement | null;
    globalMusicState: {
      currentTrack: DeezerTrack | null;
      isPlaying: boolean;
      volume: number;
      isLooping: boolean;
      playlist: DeezerTrack[];
      currentIndex: number;
    };
  }
}

if (!window.globalAudio) {
  window.globalAudio = new Audio();
  window.globalMusicState = {
    currentTrack: null,
    isPlaying: false,
    volume: 50,
    isLooping: false,
    playlist: [],
    currentIndex: -1
  };
}

export function MusicPlayer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DeezerTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<DeezerTrack | null>(window.globalMusicState.currentTrack);
  const [isPlaying, setIsPlaying] = useState(window.globalMusicState.isPlaying);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(30);
  const [volume, setVolume] = useState(window.globalMusicState.volume);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(window.globalMusicState.isLooping);
  const [isShuffled, setIsShuffled] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlist, setPlaylist] = useState<DeezerTrack[]>(window.globalMusicState.playlist);
  const [isLoading, setIsLoading] = useState(false);

  const audio = window.globalAudio!;

  useEffect(() => {
    const savedVolume = localStorage.getItem('musicVolume');
    const savedLoop = localStorage.getItem('musicLoop');
    const savedTrack = localStorage.getItem('currentMusicTrack');
    
    if (savedVolume) {
      const vol = parseInt(savedVolume);
      setVolume(vol);
      audio.volume = vol / 100;
    }
    if (savedLoop) setIsLooping(savedLoop === 'true');
    if (savedTrack) {
      try {
        const track = JSON.parse(savedTrack);
        setCurrentTrack(track);
        window.globalMusicState.currentTrack = track;
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const handleTimeUpdate = () => setProgress(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 30);
    const handleEnded = () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play();
      } else if (playlist.length > 0) {
        playNext();
      } else {
        setIsPlaying(false);
        window.globalMusicState.isPlaying = false;
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      window.globalMusicState.isPlaying = true;
    };
    const handlePause = () => {
      setIsPlaying(false);
      window.globalMusicState.isPlaying = false;
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [isLooping, playlist]);

  const fetchDeezerTrack = async (trackId: string): Promise<DeezerTrack | null> => {
    try {
      const response = await fetch(`https://api.deezer.com/track/${trackId}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (data.error) return null;
      return {
        id: data.id.toString(),
        title: data.title,
        artist: data.artist?.name || 'Unknown',
        thumbnail: data.album?.cover_medium || data.album?.cover || '',
        duration: data.duration || 30,
        previewUrl: data.preview,
        deezerId: data.id
      };
    } catch (e) {
      return null;
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await authFetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.results) {
        setSearchResults(data.results.map((r: any) => ({
          id: r.id,
          title: r.title,
          artist: r.artist || r.channel,
          thumbnail: r.thumbnail,
          duration: 30,
          previewUrl: r.previewUrl,
          deezerId: r.deezerId || parseInt(r.id)
        })));
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const playTrack = useCallback(async (track: DeezerTrack) => {
    if (!track.previewUrl) {
      const fullTrack = await fetchDeezerTrack(track.id);
      if (fullTrack?.previewUrl) {
        track = fullTrack;
      } else {
        return;
      }
    }

    setCurrentTrack(track);
    window.globalMusicState.currentTrack = track;
    localStorage.setItem('currentMusicTrack', JSON.stringify(track));
    
    audio.src = track.previewUrl;
    audio.load();
    
    try {
      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      console.error('Playback failed:', e);
    }
  }, [audio]);

  const handleSelectTrack = (track: DeezerTrack) => {
    setSearchResults([]);
    setSearchQuery('');
    playTrack(track);
  };

  const togglePlay = () => {
    if (!currentTrack?.previewUrl) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  };

  const handleSeek = (value: number[]) => {
    audio.currentTime = value[0];
    setProgress(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    localStorage.setItem('musicVolume', newVolume.toString());
    audio.volume = newVolume / 100;
    window.globalMusicState.volume = newVolume;
    if (newVolume > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => {
    audio.volume = isMuted ? volume / 100 : 0;
    setIsMuted(!isMuted);
  };

  const toggleLoop = () => {
    const newLoop = !isLooping;
    setIsLooping(newLoop);
    window.globalMusicState.isLooping = newLoop;
    localStorage.setItem('musicLoop', newLoop.toString());
  };

  const searchDeezer = async (query: string): Promise<DeezerTrack | null> => {
    try {
      const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.data || data.data.length === 0) return null;
      const track = data.data[0];
      if (!track.preview) return null;
      return {
        id: track.id.toString(),
        title: track.title,
        artist: track.artist?.name || 'Unknown',
        thumbnail: track.album?.cover_medium || track.album?.cover || '',
        duration: track.duration || 30,
        previewUrl: track.preview,
        deezerId: track.id
      };
    } catch (e) {
      return null;
    }
  };

  const loadRandomPlaylist = async (category?: 'arabic' | 'international') => {
    setIsLoading(true);
    const songs = getRandomSongs(30, category);
    const tracks: DeezerTrack[] = [];
    
    // Search in batches for speed
    for (const song of songs) {
      if (tracks.length >= 15) break;
      const track = await searchDeezer(song.query);
      if (track) tracks.push(track);
    }
    
    setPlaylist(tracks);
    window.globalMusicState.playlist = tracks;
    window.globalMusicState.currentIndex = 0;
    setIsLoading(false);
    
    if (tracks.length > 0) {
      playTrack(tracks[0]);
    }
  };

  const playNext = () => {
    if (playlist.length === 0) return;
    let nextIndex = window.globalMusicState.currentIndex + 1;
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    }
    if (nextIndex >= playlist.length) nextIndex = 0;
    window.globalMusicState.currentIndex = nextIndex;
    playTrack(playlist[nextIndex]);
  };

  const playPrev = () => {
    if (playlist.length === 0) {
      audio.currentTime = 0;
      return;
    }
    let prevIndex = window.globalMusicState.currentIndex - 1;
    if (prevIndex < 0) prevIndex = playlist.length - 1;
    window.globalMusicState.currentIndex = prevIndex;
    playTrack(playlist[prevIndex]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openInDeezer = () => {
    if (currentTrack?.deezerId) {
      window.open(`https://www.deezer.com/track/${currentTrack.deezerId}`, '_blank');
    }
  };

  return (
    <Card className="p-3 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border-purple-200 dark:border-purple-500/30 overflow-visible" data-testid="music-player">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
          <Music className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-xs">Music Player</h3>
          <p className="text-[9px] text-muted-foreground">1000+ Songs • 30s Preview</p>
        </div>
        {playlist.length > 0 && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowPlaylist(!showPlaylist)}
            className="h-6 w-6"
          >
            <List className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="relative mb-2">
        <Input
          placeholder="Search songs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="pr-8 h-8 text-xs rounded-lg bg-white/50 dark:bg-slate-800/50"
          data-testid="input-music-search"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSearch}
          disabled={isSearching}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7"
          data-testid="button-music-search"
        >
          {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
        </Button>
      </div>

      <div className="flex gap-1 mb-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadRandomPlaylist('arabic')}
          disabled={isLoading}
          className="flex-1 h-7 text-[10px] px-2"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'عربي'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadRandomPlaylist('international')}
          disabled={isLoading}
          className="flex-1 h-7 text-[10px] px-2"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'English'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadRandomPlaylist()}
          disabled={isLoading}
          className="flex-1 h-7 text-[10px] px-2"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Mix'}
        </Button>
      </div>

      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 max-h-36 overflow-y-auto space-y-1 rounded-lg bg-white/30 dark:bg-slate-800/30 p-1"
          >
            {searchResults.map((track) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => handleSelectTrack(track)}
                className="flex items-center gap-2 p-1 rounded-md hover:bg-white/50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                data-testid={`song-result-${track.id}`}
              >
                <img 
                  src={track.thumbnail} 
                  alt={track.title}
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><circle cx="12" cy="12" r="10"/></svg>';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[10px] truncate">{track.title}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{track.artist}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPlaylist && playlist.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 max-h-32 overflow-y-auto space-y-1 rounded-lg bg-white/30 dark:bg-slate-800/30 p-1"
          >
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[10px] font-medium">Playlist ({playlist.length})</span>
              <Button size="icon" variant="ghost" onClick={() => setShowPlaylist(false)} className="h-5 w-5">
                <X className="w-3 h-3" />
              </Button>
            </div>
            {playlist.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                onClick={() => {
                  window.globalMusicState.currentIndex = index;
                  playTrack(track);
                }}
                className={`flex items-center gap-2 p-1 rounded cursor-pointer transition-colors ${
                  currentTrack?.id === track.id ? 'bg-purple-500/20' : 'hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className="text-[9px] text-muted-foreground w-4">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] truncate">{track.title}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{track.artist}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {currentTrack ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20">
            <motion.div 
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 3, repeat: isPlaying ? Infinity : 0, ease: "linear" }}
              className="flex-shrink-0"
            >
              <img 
                src={currentTrack.thumbnail} 
                alt={currentTrack.title}
                className="w-10 h-10 rounded-full object-cover border-2 border-white/30 shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><circle cx="12" cy="12" r="10"/></svg>';
                }}
              />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[10px] truncate">{currentTrack.title}</p>
              <p className="text-[9px] text-muted-foreground truncate">{currentTrack.artist}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={openInDeezer}
              className="h-6 w-6"
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>

          <div className="space-y-1">
            <Slider
              value={[progress]}
              max={duration || 30}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
              <span>{formatTime(progress)}</span>
              <span className="text-purple-500">30s Preview</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsShuffled(!isShuffled)}
              className={`h-7 w-7 ${isShuffled ? 'text-purple-500 bg-purple-500/20' : ''}`}
            >
              <Shuffle className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost" onClick={playPrev} className="h-7 w-7">
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="default"
              onClick={togglePlay}
              className="h-9 w-9 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow border-0 p-0"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={playNext} className="h-7 w-7">
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleLoop}
              className={`h-7 w-7 ${isLooping ? 'text-purple-500 bg-purple-500/20' : ''}`}
            >
              <Repeat className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5 px-1">
            <Button size="icon" variant="ghost" onClick={toggleMute} className="h-6 w-6">
              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              className="flex-1"
            />
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
          <Disc3 className="w-8 h-8 mb-1.5 opacity-30" />
          <p className="text-[10px]">Search or select a category</p>
        </div>
      )}
    </Card>
  );
}
