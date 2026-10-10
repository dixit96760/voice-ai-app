"use client";

import React, { useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallRecordingPlayerProps {
  signedUrl: string;
  downloadUrl?: string | null;
  durationSeconds?: number | null;
}

export function CallRecordingPlayer({ signedUrl, downloadUrl, durationSeconds }: CallRecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const restartAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const totalDuration = durationSeconds || (audioRef.current?.duration ? Math.floor(audioRef.current.duration) : 0);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 shadow-sm">
      <audio
        ref={audioRef}
        src={signedUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={togglePlay}
            className="h-9 w-9 p-0 rounded-full bg-primary text-primary-foreground"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={restartAudio}
            className="h-8 w-8 p-0 text-muted-foreground"
            title="Restart"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <span className="text-xs font-mono text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {downloadUrl && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 px-2 gap-1 text-[11px] text-muted-foreground"
              title="Download recording"
            >
              <a href={downloadUrl} download>
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            className="h-8 w-8 p-0 text-muted-foreground"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>

          <div className="flex items-center rounded border bg-muted/30 p-0.5">
            {[0.75, 1.0, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => changeSpeed(rate)}
                className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-medium transition-colors ${
                  playbackRate === rate
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Seek bar */}
      <input
        type="range"
        min={0}
        max={totalDuration || 100}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}
