import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';

const MUSIC_TRACKS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
];

declare global {
  interface Window {
    backgroundAudio: HTMLAudioElement | null;
    backgroundMusicMuted: boolean;
  }
}

export function BackgroundMusic() {
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('backgroundMusicMuted');
    return saved === 'true';
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackIndexRef = useRef(0);

  useEffect(() => {
    if (!window.backgroundAudio) {
      const audio = new Audio();
      audio.loop = true;
      audio.volume = 0.15;
      window.backgroundAudio = audio;
    }
    
    audioRef.current = window.backgroundAudio;
    const audio = audioRef.current;
    audio.volume = 0.15;
    audio.loop = true;

    if (!audio.src) {
      trackIndexRef.current = Math.floor(Math.random() * MUSIC_TRACKS.length);
      audio.src = MUSIC_TRACKS[trackIndexRef.current];
    }

    const savedMuted = localStorage.getItem('backgroundMusicMuted') === 'true';
    window.backgroundMusicMuted = savedMuted;
    setIsMuted(savedMuted);
    
    if (!savedMuted && audio.paused) {
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.then(() => setIsPlaying(true)).catch(() => {
          const handleClick = () => {
            if (!window.backgroundMusicMuted && audioRef.current) {
              audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
            document.removeEventListener('click', handleClick);
          };
          document.addEventListener('click', handleClick);
        });
      }
    } else if (!savedMuted && !audio.paused) {
      setIsPlaying(true);
    }

    return () => {};
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
    localStorage.setItem('backgroundMusicMuted', isMuted.toString());
    window.backgroundMusicMuted = isMuted;
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="fixed top-4 right-4 z-[99999]">
      <Button
        variant="outline"
        size="icon"
        onClick={toggleMute}
        className="relative h-10 w-10 rounded-full bg-background shadow-xl border-2 border-primary/30"
        data-testid="button-toggle-music"
      >
        {isMuted ? (
          <VolumeX className="h-5 w-5 text-muted-foreground" />
        ) : (
          <>
            <Volume2 className="h-5 w-5 text-primary" />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse border-2 border-background" />
            )}
          </>
        )}
      </Button>
    </div>
  );
}
