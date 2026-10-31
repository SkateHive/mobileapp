import React, { useEffect, useState } from 'react';
import { PixelRatio } from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import { sizedImageUrl } from '~/lib/image-url';

type Props = Omit<ImageProps, 'source'> & {
  uri: string;
  /** Width the image is drawn at, in dp. */
  width: number;
};

/**
 * expo-image that downloads a resized copy of a remote image (see
 * lib/image-url.ts) and falls back to the original if the proxy fails.
 */
export function SizedImage({ uri, width, onError, ...rest }: Props) {
  const sized = sizedImageUrl(uri, PixelRatio.getPixelSizeForLayoutSize(width));
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  return (
    <Image
      {...rest}
      source={{ uri: failed ? uri : sized }}
      onError={(e) => {
        if (!failed && sized !== uri) setFailed(true);
        else onError?.(e);
      }}
    />
  );
}
