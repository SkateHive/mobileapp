import { useEffect, useState, useRef } from 'react';
import { View } from 'react-native';

interface UseInViewOptions {
  threshold?: number;
  rootMargin?: number;
}

export const useInView = (options: UseInViewOptions = {}) => {
  const { threshold = 0.5, rootMargin = 0 } = options;
  const [isInView, setIsInView] = useState(false);
  const [ref, setRef] = useState<View | null>(null);
  const measureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!ref) return;

    // Continuously check visibility
    const checkVisibility = () => {
      if (!ref) return;

      ref.measure?.((x, y, width, height, pageX, pageY) => {
        // Get screen dimensions
        const screenHeight = require('react-native').Dimensions.get('window').height;
        const screenWidth = require('react-native').Dimensions.get('window').width;

        // Calculate if element is in viewport
        const elementTop = pageY;
        const elementBottom = pageY + height;
        const elementLeft = pageX;
        const elementRight = pageX + width;

        // Check if element intersects with viewport
        const verticalInView = elementTop < screenHeight - rootMargin && elementBottom > rootMargin;
        const horizontalInView = elementLeft < screenWidth - rootMargin && elementRight > rootMargin;

        // Calculate intersection ratio for threshold
        const visibleTop = Math.max(elementTop, rootMargin);
        const visibleBottom = Math.min(elementBottom, screenHeight - rootMargin);
        const visibleLeft = Math.max(elementLeft, rootMargin);
        const visibleRight = Math.min(elementRight, screenWidth - rootMargin);

        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const visibleWidth = Math.max(0, visibleRight - visibleLeft);
        const visibleArea = visibleHeight * visibleWidth;
        const totalArea = width * height;

        const intersectionRatio = totalArea > 0 ? visibleArea / totalArea : 0;
        const isVisible = verticalInView && horizontalInView && intersectionRatio >= threshold;

        setIsInView(isVisible);
      });
    };

    // Initial check
    checkVisibility();

    // Set up periodic checking (similar to intersection observer)
    const interval = setInterval(checkVisibility, 250); // Check every 250ms

    return () => {
      clearInterval(interval);
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }
    };
  }, [ref, threshold, rootMargin]);

  return { ref: setRef, isInView };
};
