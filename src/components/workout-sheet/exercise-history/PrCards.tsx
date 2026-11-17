import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../../theme/useColors';
import { ms } from '../../../theme/responsive';
import type { HistoryStyles } from './historyStyles';
import type { PRData } from './useExerciseHistory';

/** The PERSONAL RECORDS section: heaviest set, most reps, best session volume. */
function PrCards({ styles, prs }: { styles: HistoryStyles; prs: PRData }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>PERSONAL RECORDS</Text>
      <View style={styles.prRow}>
        <View style={styles.prCard}>
          <Ionicons name="trophy" size={ms(16)} color={colors.accentOrange} />
          <Text style={styles.prValue}>{prs.heaviestKg > 0 ? `${prs.heaviestKg}kg` : '—'}</Text>
          <Text style={styles.prSub}>{prs.heaviestKg > 0 ? `${prs.heaviestReps} reps` : ''}</Text>
          <Text style={styles.prLabel}>Heaviest</Text>
        </View>
        <View style={styles.prCard}>
          <Ionicons name="repeat" size={ms(16)} color={colors.accentBlue} />
          <Text style={styles.prValue}>{prs.mostReps > 0 ? `${prs.mostReps}` : '—'}</Text>
          <Text style={styles.prSub}>{prs.mostReps > 0 ? `${prs.mostRepsKg}kg` : ''}</Text>
          <Text style={styles.prLabel}>Most Reps</Text>
        </View>
        <View style={styles.prCard}>
          <Ionicons name="flame" size={ms(16)} color={colors.accentRed} />
          <Text style={styles.prValue}>{prs.bestVolume > 0 ? `${prs.bestVolume}` : '—'}</Text>
          <Text style={styles.prSub}>{prs.bestVolume > 0 ? 'kg' : ''}</Text>
          <Text style={styles.prLabel}>Best Volume</Text>
        </View>
      </View>
    </View>
  );
}

export default React.memo(PrCards);
