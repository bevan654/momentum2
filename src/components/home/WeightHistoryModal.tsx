import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import BottomSheet from '../workout-sheet/BottomSheet';
import type { WeightEntry } from '../../stores/useWeightStore';

const DELETE_THRESHOLD = -80;

interface Props {
  visible: boolean;
  onClose: () => void;
  entries: WeightEntry[];
  onDelete?: (date: string) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const SwipeableRow = React.memo(function SwipeableRow({
  item,
  onDelete,
  colors,
  styles,
}: {
  item: WeightEntry;
  onDelete?: (date: string) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const translateX = useSharedValue(0);

  const handleDelete = useCallback(() => {
    onDelete?.(item.date);
  }, [item.date, onDelete]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, DELETE_THRESHOLD - 20);
      }
    })
    .onEnd((e) => {
      if (e.translationX < DELETE_THRESHOLD) {
        runOnJS(handleDelete)();
        translateX.value = withTiming(0, { duration: 200 });
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -20 ? 1 : 0,
  }));

  return (
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.deleteBackground, deleteStyle]}>
        <Ionicons name="trash-outline" size={ms(20)} color="#fff" />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, rowStyle]}>
          <Text style={styles.date}>{formatDate(item.date)}</Text>
          <Text style={styles.weight}>{item.weight} kg</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

export default function WeightHistoryModal({ visible, onClose, entries, onDelete }: Props) {
  const reversed = useMemo(() => [...entries].reverse(), [entries]);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="70%"
      modal
      bgColor={colors.card}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Weight History</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>Done</Text>
        </TouchableOpacity>
      </View>

      {reversed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No weight entries yet</Text>
        </View>
      ) : (
        <FlatList
          data={reversed}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <SwipeableRow
              item={item}
              onDelete={onDelete}
              colors={colors}
              styles={styles}
            />
          )}
        />
      )}
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sw(20),
    paddingBottom: sw(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(25),
    fontFamily: Fonts.bold,
  },
  closeText: {
    color: colors.accent,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
  list: {
    paddingHorizontal: sw(20),
    paddingTop: sw(12),
    paddingBottom: sw(34),
  },
  swipeContainer: {
    overflow: 'hidden',
  },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.accentRed,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: sw(20),
    borderRadius: sw(8),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(14),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  date: {
    color: colors.textSecondary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.medium,
  },
  weight: {
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
  empty: {
    padding: sw(40),
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.medium,
  },
});
