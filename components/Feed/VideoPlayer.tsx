import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect } from 'react';

interface VideoPlayerProps {
  url: string;
  playing?: boolean;
}

export const VideoPlayer = React.memo(({ url, playing = true }: VideoPlayerProps) => {
  const player = useVideoPlayer(url, player => {
    player.loop = true;
    player.muted = true; // Start muted for autoplay (better UX)
  });
  
  useEffect(() => {
    if (playing) {
      player.play();
    } else {
      player.pause();
    }
  }, [playing, player]);
  
  return (
    <VideoView
      style={{ width: '100%', height: '100%' }}
      contentFit='contain'
      player={player}
      fullscreenOptions={{ enable: true }}
    />
  );
});