import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useActiveWorkoutStore } from '../../../stores/useActiveWorkoutStore';
import { pickAndUploadWorkoutPhoto } from '../../../utils/uploadWorkoutPhoto';
import type { ShareVisibility, ShareTextRef } from './SharePreviewCard';

/** Share-to-feed state for the just-completed summary: photo, visibility, post, and the
 *  confirm-before-exit dialog. The title/caption live in SharePreviewCard and reach the post via shareTextRef. */
export function useSummaryShare({ isJustCompleted, workoutId, userId, onDismiss }: {
  isJustCompleted: boolean;
  workoutId: string | undefined;
  userId: string | undefined;
  onDismiss: () => void;
}) {
  const commitFeedPost = useActiveWorkoutStore((s) => s.commitFeedPost);
  const [sharePhotoUrl, setSharePhotoUrl] = useState<string | null>(null);
  const [sharePhotoUploading, setSharePhotoUploading] = useState(false);
  const [shareVisibility, setShareVisibility] = useState<ShareVisibility>('public');
  const shareTextRef: ShareTextRef = useRef({ title: '', caption: '' });
  const [shareSubmitting, setShareSubmitting] = useState(false);

  // Themed confirm-before-exit dialog (just-completed mode only)
  const [confirmExitVisible, setConfirmExitVisible] = useState(false);

  const handlePickSharePhoto = useCallback(async () => {
    if (!workoutId || !userId || sharePhotoUploading) return;
    setSharePhotoUploading(true);
    try {
      const result = await pickAndUploadWorkoutPhoto(userId, workoutId);
      if (result) {
        setSharePhotoUrl(result.publicUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } finally {
      setSharePhotoUploading(false);
    }
  }, [workoutId, userId, sharePhotoUploading]);

  const handleRemoveSharePhoto = useCallback(() => {
    Alert.alert('Remove photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setSharePhotoUrl(null) },
    ]);
  }, []);

  const handlePostToFeed = useCallback(() => {
    if (shareSubmitting) return;
    setShareSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    commitFeedPost({
      visibility: shareVisibility,
      title: shareTextRef.current.title,
      caption: shareTextRef.current.caption,
    }).catch(() => {});
    // Dismiss immediately — feed insert is fire-and-forget
    onDismiss();

  }, [shareSubmitting, commitFeedPost, shareVisibility, onDismiss]);

  // Confirm before exiting the just-completed summary without sharing.
  // Workout is already in `workouts`; the dialog exists so users don't lose the feed post by accident.
  const handleCloseRequest = useCallback(() => {
    if (!isJustCompleted || shareVisibility === 'private') {
      onDismiss();
      return;
    }
    setConfirmExitVisible(true);
  }, [isJustCompleted, shareVisibility, onDismiss]);

  const handleConfirmExitPost = useCallback(() => {
    setConfirmExitVisible(false);
    handlePostToFeed();
  }, [handlePostToFeed]);

  const handleConfirmExitDiscard = useCallback(() => {
    setConfirmExitVisible(false);
    onDismiss();
  }, [onDismiss]);

  const handleConfirmExitCancel = useCallback(() => setConfirmExitVisible(false), []);

  return {
    sharePhotoUrl, sharePhotoUploading, shareVisibility, setShareVisibility, shareTextRef, shareSubmitting,
    handlePickSharePhoto, handleRemoveSharePhoto, handlePostToFeed,
    confirmExitVisible, handleCloseRequest, handleConfirmExitPost, handleConfirmExitDiscard, handleConfirmExitCancel,
  };
}
