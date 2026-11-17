import React, { useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { useColors } from '../../theme/useColors';
import type { SupplementConfig } from '../../stores/useSupplementStore';
import CardDetailSheet, {
  CardDetailHero,
  CardDetailSectionLabel,
  CardDetailBar,
  CardDetailFooter,
  QuickAddGrid,
  QuickAddButton,
} from './CardDetailSheet';

/** "1000" → "1k" for round thousands; used on the cell buttons and in the popup. */
export function formatIncrement(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}k`;
  return String(value);
}

interface Props {
  visible: boolean;
  onClose: () => void;
  config: SupplementConfig;
  total: number;
  onAdd: (key: string, amount: number) => void;
  onReset: (key: string) => void;
}

/** A supplement cell's detail popup: total vs goal, progress and quick-add amounts. */
function SupplementDetailModal({ visible, onClose, ...rest }: Props) {
  return (
    <CardDetailSheet visible={visible} onClose={onClose}>
      <SupplementDetailContent onClose={onClose} {...rest} />
    </CardDetailSheet>
  );
}

/** Mounted only while the popup is, so closed cells build none of this. */
function SupplementDetailContent({ config, total, onAdd, onReset, onClose }: Omit<Props, 'visible'>) {
  const colors = useColors();

  const isOver = total > config.dailyGoal && config.dailyGoal > 0;
  const remaining = Math.max(0, config.dailyGoal - total);
  const overAmount = Math.max(0, total - config.dailyGoal);
  const pct = config.dailyGoal > 0 ? Math.round((total / config.dailyGoal) * 100) : 0;

  // Build quick-add amounts from increments + some common fractions
  const quickAmounts = useMemo(() => {
    const amounts = new Set<number>();
    for (const inc of config.increments) {
      amounts.add(inc);
      if (inc > 1) {
        const half = Math.round(inc / 2);
        if (half > 0 && half !== inc) amounts.add(half);
        const double = inc * 2;
        amounts.add(double);
      }
    }
    return Array.from(amounts).sort((a, b) => a - b);
  }, [config.increments]);

  return (
    <>
      {/* Hero */}
      <CardDetailHero
        value={total}
        valueColor={isOver ? config.color : undefined}
        unit={config.unit}
        label={isOver ? `${overAmount}${config.unit} over goal` : `${remaining}${config.unit} remaining`}
        stats={[
          { value: config.dailyGoal, label: 'Goal' },
          { value: `${pct}%`, label: 'Done' },
        ]}
        dividerColor={colors.surface}
      />

      {/* Progress bar */}
      <CardDetailSectionLabel>{config.name}</CardDetailSectionLabel>
      <CardDetailBar pct={pct} color={config.color} trackColor={colors.surface} />

      {/* Quick add buttons */}
      <CardDetailSectionLabel spaced>Quick Add</CardDetailSectionLabel>
      <QuickAddGrid>
        {quickAmounts.map((amount) => (
          <QuickAddButton
            key={amount}
            label={`+${formatIncrement(amount)}${config.unit}`}
            color={config.color}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onAdd(config.key, amount); }}
          />
        ))}
      </QuickAddGrid>

      {/* Undo + Close */}
      <CardDetailFooter onClose={onClose} onUndo={() => onReset(config.key)} showUndo={total > 0} />
    </>
  );
}

export default React.memo(SupplementDetailModal);
