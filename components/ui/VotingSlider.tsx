import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Dimensions, PanResponder } from 'react-native';
import { theme } from '~/lib/theme';
import { Text } from './text';

interface VotingSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
}

const { width: screenWidth } = Dimensions.get('window');
const SLIDER_WIDTH = screenWidth * 0.55; // 55% of screen width to leave space for value

export function VotingSlider({ 
  value, 
  onValueChange, 
  minimumValue = 1, 
  maximumValue = 100,
  step = 1 
}: VotingSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const trackLayoutRef = useRef<{ x: number; width: number }>({ x: 0, width: SLIDER_WIDTH });
  
  const updateValueFromPosition = useCallback((pageX: number) => {
    const { x, width } = trackLayoutRef.current;
    const relativeX = pageX - x;
    const percentage = Math.max(0, Math.min(1, relativeX / width));
    const newValue = minimumValue + percentage * (maximumValue - minimumValue);
    const clampedValue = Math.max(minimumValue, Math.min(maximumValue, newValue));
    const steppedValue = Math.round(clampedValue / step) * step;
    onValueChange(steppedValue);
  }, [onValueChange, minimumValue, maximumValue, step]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      setIsDragging(true);
      updateValueFromPosition(event.nativeEvent.pageX);
    },
    onPanResponderMove: (event) => {
      updateValueFromPosition(event.nativeEvent.pageX);
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
    },
    onPanResponderTerminate: () => {
      setIsDragging(false);
    },
  });

  const onTrackLayout = (event: any) => {
    event.target.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
      trackLayoutRef.current = { x: pageX, width };
    });
  };

  const thumbPosition = ((value - minimumValue) / (maximumValue - minimumValue)) * SLIDER_WIDTH;

  return (
    <View style={styles.container}>
      <View style={styles.sliderContainer}>
        <View
          style={[styles.trackContainer, { width: SLIDER_WIDTH }]}
          onLayout={onTrackLayout}
          {...panResponder.panHandlers}
        >
          <View style={styles.track}>
            <View 
              style={[styles.progress, { width: thumbPosition }]} 
            />
          </View>
          
          <View
            style={[
              styles.thumb,
              { 
                left: Math.max(0, Math.min(SLIDER_WIDTH - 16, thumbPosition - 8)),
                backgroundColor: isDragging ? theme.colors.primary : theme.colors.green,
                transform: [{ scale: isDragging ? 1.3 : 1 }]
              }
            ]}
          />
        </View>
        
        <Text style={styles.valueText}>{value}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  trackContainer: {
    position: 'relative',
    height: 32,
    justifyContent: 'center',
    paddingVertical: 14, // Increase touch area
  },
  track: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    width: '100%',
  },
  progress: {
    height: 4,
    backgroundColor: theme.colors.green,
    borderRadius: 2,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: theme.colors.green,
    borderRadius: 8,
    top: 8, // Center vertically (32 - 16) / 2
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  valueText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.green,
    fontFamily: theme.fonts.regular,
    minWidth: 35,
    textAlign: 'right',
    marginLeft: theme.spacing.xs,
  },
});
