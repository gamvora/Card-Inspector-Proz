import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const LOFI_STREAM = 'https://stream.zeno.fm/0r0xa792kwzuv';

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

  useEffect(() => {
    if (!window.backgroundAudio) {
      const audio = new Audio();
      audio.loop = true;
      audio.volume = 0.12;
      audio.crossOrigin = 'anonymous';
      window.backgroundAudio = audio;
    }
    
    audioRef.current = window.backgroundAudio;
    const audio = audioRef.current;
    audio.volume = 0.12;

    if (!audio.src || audio.src === '') {
      audio.src = LOFI_STREAM;
    }

    const savedMuted = localStorage.getItem('backgroundMusicMuted') === 'true';
    window.backgroundMusicMuted = savedMuted;
    setIsMuted(savedMuted);
    
    const tryPlay = () => {
      if (!window.backgroundMusicMuted && audioRef.current) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
    };

    if (!savedMuted && audio.paused) {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          document.addEventListener('click', tryPlay, { once: true });
          document.addEventListener('touchstart', tryPlay, { once: true });
        });
    } else if (!savedMuted && !audio.paused) {
      setIsPlaying(true);
    }

    return () => {
      document.removeEventListener('click', tryPlay);
      document.removeEventListener('touchstart', tryPlay);
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
    <button
      onClick={toggleMute}
      className="fixed bottom-20 left-4 z-[99999] flex items-center gap-2 px-3 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg transition-all duration-300 hover:bg-black/70 hover:scale-105 active:scale-95"
      data-testid="button-toggle-music"
    >
      {isMuted ? (
        <>
          <VolumeX className="h-4 w-4 text-white/60" />
          <span className="text-xs text-white/60 font-medium">Music Off</span>
        </>
      ) : (
        <>
          <Volume2 className="h-4 w-4 text-white" />
          <span className="text-xs text-white font-medium">Lofi</span>
          {isPlaying && (
            <span className="flex gap-0.5">
              <span className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </>
      )}
    </button>
  );
}
