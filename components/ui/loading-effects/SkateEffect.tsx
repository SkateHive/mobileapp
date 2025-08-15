import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, View, Easing, StyleSheet } from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import type { LoadingEffect } from './types';

const { width, height } = Dimensions.get('window');
const INITIAL_PIECES = 3; // Start with fewer pieces
const MAX_PIECES = 12;    // Reduce maximum pieces
const PIECE_BATCH = 1;    // Add pieces one by one
const BATCH_INTERVAL = 500; // Slower piece addition

const PIECE_COLORS = {
  light: {
    deck: ['#FF5252', '#FF7B7B', '#4CAF50', '#81C784', '#2196F3', '#64B5F6'],  // Red, Green, Blue variants
    truck: ['#757575', '#9E9E9E', '#BDBDBD'],  // Grey metallic variants
    wheel: ['#FFA000', '#FFB300', '#FFC107']   // Yellow/Orange variants
  },
  dark: {
    deck: ['#D32F2F', '#388E3C', '#1976D2'],   // Darker Red, Green, Blue
    truck: ['#616161', '#757575', '#9E9E9E'],   // Darker metallic
    wheel: ['#FF8F00', '#FFA000', '#FFB300']    // Darker yellow/orange
  }
};

interface FallingPiece {
  id: string;
  x: number;
  y: Animated.Value;
  speed: number;
  rotate: Animated.Value;
  opacity: Animated.Value;
  piece: typeof PIECES[number];
  color: string;
}

const PIECES = [
  {
    id: 'deck',
    path: 'M5 10 L55 10 Q58 10 58 7 L58 5 Q58 2 55 2 L5 2 Q2 2 2 5 L2 7 Q2 10 5 10 Z',
    width: 60,
    height: 20,
  },
  {
    id: 'truck1',
    path: 'M0 0 L15 0 L15 5 L0 5 Z',
    width: 15,
    height: 5,
  },
  {
    id: 'truck2',
    path: 'M0 0 L15 0 L15 5 L0 5 Z',
    width: 15,
    height: 5,
  },
  {
    id: 'wheel1',
    isCircle: true,
    radius: 4,
  },
  {
    id: 'wheel2',
    isCircle: true,
    radius: 4,
  },
  {
    id: 'wheel3',
    isCircle: true,
    radius: 4,
  },
  {
    id: 'wheel4',
    isCircle: true,
    radius: 4,
  },
];

export function SkateEffect() {
  const colors = PIECE_COLORS.dark;
  const [numPieces, setNumPieces] = useState(INITIAL_PIECES);
  const [opacity] = useState(new Animated.Value(0));
  
  // Pre-initialize pieces outside of render
  const fallingPieces = useRef<FallingPiece[]>(
    Array(MAX_PIECES).fill(0).map(() => {
      const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
      const pieceColor = piece.isCircle 
        ? colors.wheel[Math.floor(Math.random() * colors.wheel.length)]
        : piece.id.includes('truck')
          ? colors.truck[Math.floor(Math.random() * colors.truck.length)]
          : colors.deck[Math.floor(Math.random() * colors.deck.length)];

      return {
        id: Math.random().toString(),
        x: Math.random() * (width - 60),
        y: new Animated.Value(-50),
        speed: Math.random() * 2 + 1.5, // Slightly slower speeds
        rotate: new Animated.Value(0),
        opacity: new Animated.Value(0),
        piece,
        color: pieceColor
      };
    })
  ).current;

  useEffect(() => {
    // Fade in effect more gradually
    Animated.timing(opacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Add pieces more gradually
    const pieceInterval = setInterval(() => {
      setNumPieces(prev => 
        prev < MAX_PIECES ? prev + PIECE_BATCH : prev
      );
    }, BATCH_INTERVAL);

    // Start animations only for visible pieces
    const animations = fallingPieces
      .slice(0, numPieces)
      .map(piece => 
        Animated.loop(
          Animated.sequence([
            Animated.timing(piece.y, {
              toValue: height + 50,
              duration: 15000 / piece.speed, // Slower fall
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(piece.y, {
              toValue: -50,
              duration: 0,
              useNativeDriver: true,
            })
          ])
        )
      );

    Animated.stagger(100, animations).start();

    return () => {
      clearInterval(pieceInterval);
      animations.forEach(anim => anim.stop());
    };
  }, [numPieces]);

  return (
    <Animated.View 
      style={[styles.container, { opacity }]}
    >
      {fallingPieces.slice(0, numPieces).map((piece) => (
        <Animated.View
          key={piece.id}
          style={{
            position: 'absolute',
            left: piece.x,
            transform: [
              { translateY: piece.y },
              { rotate: piece.rotate.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg'],
              })},
            ],
            opacity: piece.opacity,
          }}
        >
          {piece.piece.isCircle ? (
            <Svg width={8} height={8} viewBox="-4 -4 8 8">
              <Circle cx={0} cy={0} r={piece.piece.radius} fill={piece.color} />
            </Svg>
          ) : (
            <Svg 
              width={piece.piece.width} 
              height={piece.piece.height} 
              viewBox={`0 0 ${piece.piece.width} ${piece.piece.height}`}
            >
              <Path d={piece.piece.path} fill={piece.color} />
            </Svg>
          )}
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
});

export const skateEffect: LoadingEffect = {
  id: 'skate',
  component: SkateEffect
};