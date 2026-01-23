import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';

const MUSIC_TRACKS = [
  'https://cdn.pixabay.com/audio/2022/10/25/audio_2cac175e89.mp3',
  'https://cdn.pixabay.com/audio/2022/03/15/audio_d49d06c1af.mp3',
  'https://cdn.pixabay.com/audio/2024/11/29/audio_7a02c16b66.mp3',
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
    <div className="fixed top-3 right-3 z-[9999]">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMute}
        className="relative bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg"
        data-testid="button-toggle-music"
      >
        {isMuted ? (
          <VolumeX className="h-4 w-4 text-muted-foreground" />
        ) : (
          <>
            <Volume2 className="h-4 w-4 text-primary" />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </>
        )}
      </Button>
    </div>
  );
}
