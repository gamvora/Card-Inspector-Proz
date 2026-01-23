import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const LOFI_STREAM = 'https://stream.zeno.fm/0r0xa792kwzuv';

// Initialize audio globally once
export function initBackgroundMusic() {
  if (!window.backgroundAudio) {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.08;
    audio.crossOrigin = 'anonymous';
    audio.src = LOFI_STREAM;
    window.backgroundAudio = audio;
    
    const savedMuted = localStorage.getItem('backgroundMusicMuted') === 'true';
    window.backgroundMusicMuted = savedMuted;
    
    if (!savedMuted) {
      const tryPlay = () => {
        if (window.backgroundAudio && !window.backgroundMusicMuted) {
          window.backgroundAudio.play().catch(() => {});
        }
        document.removeEventListener('click', tryPlay);
        document.removeEventListener('touchstart', tryPlay);
      };
      
      window.backgroundAudio.play().catch(() => {
        document.addEventListener('click', tryPlay, { once: true });
        document.addEventListener('touchstart', tryPlay, { once: true });
      });
    }
  }
}

declare global {
  interface Window {
    backgroundAudio: HTMLAudioElement | null;
    backgroundMusicMuted: boolean;
  }
}

// Button component for Home page only
export function MusicToggleButton() {
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('backgroundMusicMuted') === 'true';
  });
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const checkPlaying = () => {
      if (window.backgroundAudio) {
        setIsPlaying(!window.backgroundAudio.paused);
      }
    };
    checkPlaying();
    const interval = setInterval(checkPlaying, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem('backgroundMusicMuted', newMuted.toString());
    window.backgroundMusicMuted = newMuted;
    
    if (window.backgroundAudio) {
      if (newMuted) {
        window.backgroundAudio.pause();
        setIsPlaying(false);
      } else {
        window.backgroundAudio.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
    }
  };

  return (
    <button
      onClick={toggleMute}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 transition-all duration-200 hover:scale-105 active:scale-95"
      data-testid="button-toggle-music"
    >
      {isMuted ? (
        <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <>
          <Volume2 className="h-3.5 w-3.5 text-purple-500" />
          {isPlaying && (
            <span className="flex gap-[2px] items-end h-3">
              <span className="w-[3px] h-full bg-purple-500 rounded-full animate-pulse" />
              <span className="w-[3px] h-2 bg-pink-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-[3px] h-2.5 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </>
      )}
    </button>
  );
}
