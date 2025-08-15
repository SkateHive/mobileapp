import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, View, StyleSheet } from 'react-native';
import type { LoadingEffect } from './types';

const { width, height } = Dimensions.get('window');
const CHARACTERS = '01';
const FONT_SIZE = 14;
const NUM_COLUMNS = Math.floor(width / FONT_SIZE);
const INITIAL_DROPS = 10; // Start with fewer drops
const MAX_DROPS = 25;

interface RainDrop {
  x: number;
  y: Animated.Value;
  speed: number;
  length: number;
  chars: string[];
}

export function VideoBackgorundEffect() {
  const rainDrops = useRef<RainDrop[]>([]);
  const [opacity] = useState(new Animated.Value(0));
  const [numDrops, setNumDrops] = useState(INITIAL_DROPS);

  // Initialize drops immediately
  if (rainDrops.current.length === 0) {
    rainDrops.current = Array(MAX_DROPS).fill(0).map(() => ({
      x: Math.floor(Math.random() * NUM_COLUMNS) * FONT_SIZE,
      y: new Animated.Value(-FONT_SIZE * 5),
      speed: Math.random() * 2 + 1,
      length: Math.floor(Math.random() * 15) + 5,
      chars: Array(Math.floor(Math.random() * 15) + 5)
        .fill(0)
        .map(() => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)])
    }));
  }

  useEffect(() => {
    // Fade in the effect
    Animated.timing(opacity, {
      toValue: 0.15,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Gradually increase number of drops
    const dropInterval = setInterval(() => {
      setNumDrops(prev => 
        prev < MAX_DROPS ? prev + 3 : prev
      );
    }, 200);

    // Start animations for visible drops
    const animations = rainDrops.current
      .slice(0, numDrops)
      .map(drop => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(drop.y, {
              toValue: height + FONT_SIZE * drop.length,
              duration: 10000 / drop.speed,
              useNativeDriver: true,
            }),
            Animated.timing(drop.y, {
              toValue: -FONT_SIZE * drop.length,
              duration: 0,
              useNativeDriver: true,
            })
          ])
        );
      });

    Animated.parallel(animations).start();

    return () => {
      clearInterval(dropInterval);
      animations.forEach(anim => anim.stop());
    };
  }, [numDrops]);

  return (
    <Animated.View 
      style={[styles.container, { opacity }]}
    >
      {rainDrops.current.slice(0, numDrops).map((drop, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dropContainer,
            {
              left: drop.x,
              transform: [{ translateY: drop.y }],
            }
          ]}
        >
          {drop.chars.map((char, j) => (
            <Animated.Text
              key={j}
              style={[
                styles.character,
                {
                  color: '#00ff00',
                  opacity: Math.max(1 - j / drop.length, 0.2),
                }
              ]}
            >
              {char}
            </Animated.Text>
          ))}
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  dropContainer: {
    position: 'absolute',
  },
  character: {
    fontSize: FONT_SIZE,
    fontFamily: 'monospace',
  },
});

export const videobgEffect: LoadingEffect = {
  id: 'videobg',
  component: VideoBackgorundEffect
};