import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, Image, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw } from '../../../theme/responsive';
import type { ActivityFeedItem } from '../../../lib/friendsDatabase';
import { PHOTO_WIDTH, PHOTO_HEIGHT } from './feedHelpers';
import WorkoutSummarySlot from './WorkoutSummarySlot';

const PhotoOverviewCarousel = React.memo(function PhotoOverviewCarousel({
  photoUrl,
  item,
}: {
  photoUrl: string;
  item: ActivityFeedItem;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [page, setPage] = useState(0);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / PHOTO_WIDTH);
    setPage(idx);
  }, []);

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        snapToInterval={PHOTO_WIDTH}
        decelerationRate="fast"
        style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
        contentContainerStyle={{ width: PHOTO_WIDTH * 2 }}
      >
        <View style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}>
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        </View>
        <View style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT, justifyContent: 'center' }}>
          <WorkoutSummarySlot item={item} />
        </View>
      </ScrollView>
      <View style={styles.pageDots}>
        <View style={[styles.pageDot, page === 0 && styles.pageDotActive]} />
        <View style={[styles.pageDot, page === 1 && styles.pageDotActive]} />
      </View>
    </View>
  );
});

export default PhotoOverviewCarousel;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    photo: {
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      backgroundColor: colors.cardBorder,
    },
    pageDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: sw(5),
      paddingTop: sw(8),
      paddingBottom: sw(2),
    },
    pageDot: {
      width: sw(5),
      height: sw(5),
      borderRadius: sw(3),
      backgroundColor: colors.cardBorder,
    },
    pageDotActive: {
      backgroundColor: colors.accent,
    },
  });
