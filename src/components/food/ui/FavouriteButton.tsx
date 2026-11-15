import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { useFavouritesStore } from '../../../stores/useFavouritesStore';
import type { FoodCatalogItem } from '../../../stores/useFoodLogStore';

/** Heart toggle that adds / removes a food from favourites. */
function FavouriteButton({ item }: { item: FoodCatalogItem }) {
  const colors = useColors();
  // Subscribe to a boolean, so only this row re-renders when its own state changes.
  const isFav = useFavouritesStore(
    useCallback((st) => st.isFavourite(item), [item]),
  );
  const toggle = useCallback(() => {
    Haptics.selectionAsync();
    const st = useFavouritesStore.getState();
    if (st.isFavourite(item)) st.removeFavourite(item);
    else st.addFavourite(item);
  }, [item]);

  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel={isFav ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`}
      accessibilityState={{ selected: isFav }}
    >
      <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={ms(17)} color={isFav ? colors.accentRed : colors.textTertiary} />
    </Pressable>
  );
}

export default React.memo(FavouriteButton);

const styles = StyleSheet.create({
  btn: {
    width: sw(36),
    height: sw(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
