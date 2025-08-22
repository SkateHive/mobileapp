import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
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
  const [trackLayout, setTrackLayout] = useState<{ x: number; width: number; y: number }>({ x: 0, width: SLIDER_WIDTH, y: 0 });
  
  const updateValueFromPosition = useCallback((pageX: number) => {
    const relativeX = pageX - trackLayout.x;
    const percentage = Math.max(0, Math.min(1, relativeX / trackLayout.width));
    const newValue = minimumValue + percentage * (maximumValue - minimumValue);
    const clampedValue = Math.max(minimumValue, Math.min(maximumValue, newValue));
    const steppedValue = Math.round(clampedValue / step) * step;
    onValueChange(steppedValue);
  }, [onValueChange, minimumValue, maximumValue, step, trackLayout]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => false,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    
    onPanResponderGrant: (event: GestureResponderEvent) => {
      setIsDragging(true);
      updateValueFromPosition(event.nativeEvent.pageX);
    },
    
    onPanResponderMove: (event: GestureResponderEvent) => {
      updateValueFromPosition(event.nativeEvent.pageX);
    },
    
    onPanResponderRelease: () => {
      setIsDragging(false);
    },
    
    onPanResponderTerminate: () => {
      setIsDragging(false);
    },
  });

  const onTrackLayout = useCallback((event: any) => {
    const view = event.currentTarget || event.target;
    view.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
      setTrackLayout({ x: pageX, width, y: pageY });
    });
  }, []);

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
                left: Math.max(0, Math.min(SLIDER_WIDTH - 18, thumbPosition - 9)),
                backgroundColor: isDragging ? theme.colors.primary : theme.colors.green,
                transform: [{ scale: isDragging ? 1.2 : 1 }]
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
    paddingVertical: 14, // Good touch area
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
    width: 18, // Reasonable size - not too big, not too small
    height: 18,
    backgroundColor: theme.colors.green,
    borderRadius: 9,
    top: 7, // Center vertically ((32 - 18) / 2)
    elevation: 5,
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
