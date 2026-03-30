import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Text } from './text';
import { useAppSettings } from '~/lib/AppSettingsContext';
import { theme } from '~/lib/theme';
import { MatrixRain } from './loading-effects/MatrixRain';
import { ContentSkeleton, GridSkeleton } from './Skeletons';

interface ThemedLoadingProps {
  size?: 'small' | 'large' | number;
  type?: 'auto' | 'spinner' | 'skeleton' | 'matrix';
  color?: string;
  gridTileSize?: number;
  label?: string;
}

export function ThemedLoading({ 
  size = 'small', 
  type = 'auto', 
  color = theme.colors.green,
  gridTileSize,
  label
}: ThemedLoadingProps) {
  const { settings } = useAppSettings();
  
  // Determine effective type based on theme if 'auto'
  const effectiveType = type === 'auto' 
    ? (settings.theme === 'matrix' ? 'matrix' 
       : 'spinner')
    : type;

  switch (effectiveType) {
    case 'matrix':
      return (
        <View style={styles.matrixContainer}>
          <MatrixRain opacity={0.3} intensity={0.5} />
          {label && (
            <View style={styles.overlayLabel}>
              <Text style={styles.loadingText}>{label}</Text>
            </View>
          )}
        </View>
      );
    
    case 'skeleton':
      if (gridTileSize) {
        return <GridSkeleton tileSize={gridTileSize} />;
      }
      return <ContentSkeleton />;
      
    case 'spinner':
    default:
      return (
        <View style={styles.spinnerContainer}>
          <ActivityIndicator 
            size={typeof size === 'number' ? 'small' : size} 
            color={color} 
          />
          {label && <Text style={styles.loadingText}>{label}</Text>}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  spinnerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  matrixContainer: {
    width: '100%',
    flex: 1,
    minHeight: 80,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  overlayLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  loadingText: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    fontFamily: theme.fonts.regular,
    opacity: 0.8,
  },
});
