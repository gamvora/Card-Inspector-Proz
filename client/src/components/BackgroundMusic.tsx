import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';

const MUSIC_TRACKS = [
  'https://cdn.pixabay.com/audio/2024/11/29/audio_7a02c16b66.mp3',
  'https://cdn.pixabay.com/audio/2024/10/17/audio_a0f49ba498.mp3',
  'https://cdn.pixabay.com/audio/2024/09/10/audio_6e5d7d1912.mp3',
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
      audio.loop = false;
      audio.volume = 0.3;
      window.backgroundAudio = audio;
    }
    
    audioRef.current = window.backgroundAudio;
    const audio = audioRef.current;

    const playNextTrack = () => {
      trackIndexRef.current = (trackIndexRef.current + 1) % MUSIC_TRACKS.length;
      audio.src = MUSIC_TRACKS[trackIndexRef.current];
      if (!isMuted) {
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener('ended', playNextTrack);

    if (!audio.src) {
      trackIndexRef.current = Math.floor(Math.random() * MUSIC_TRACKS.length);
      audio.src = MUSIC_TRACKS[trackIndexRef.current];
    }

    const savedMuted = localStorage.getItem('backgroundMusicMuted') === 'true';
    window.backgroundMusicMuted = savedMuted;
    
    if (!savedMuted && audio.paused) {
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.then(() => setIsPlaying(true)).catch(() => {
          const handleClick = () => {
            if (!window.backgroundMusicMuted) {
              audio.play().then(() => setIsPlaying(true)).catch(() => {});
            }
            document.removeEventListener('click', handleClick);
          };
          document.addEventListener('click', handleClick);
        });
      }
    }

    return () => {
      audio.removeEventListener('ended', playNextTrack);
    };
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
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMute}
      className="relative"
      data-testid="button-toggle-music"
    >
      {isMuted ? (
        <VolumeX className="h-5 w-5 text-muted-foreground" />
      ) : (
        <>
          <Volume2 className="h-5 w-5 text-primary" />
          {isPlaying && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </>
      )}
    </Button>
  );
}
