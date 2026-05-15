import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';

const BUCKET = 'workout_photos';

type Source = 'camera' | 'library';

async function pickFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

async function pickFromLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

function chooseSource(): Promise<Source | null> {
  return new Promise((resolve) => {
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => resolve('camera') },
      { text: 'Choose from library', onPress: () => resolve('library') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

export async function pickAndUploadWorkoutPhoto(
  userId: string,
  workoutId: string,
): Promise<{ path: string; publicUrl: string } | null> {
  const source = await chooseSource();
  if (!source) return null;

  const uri = source === 'camera' ? await pickFromCamera() : await pickFromLibrary();
  if (!uri) return null;

  // RN fetch on a local file URI returns a Blob; supabase-js v2 accepts ArrayBuffer.
  const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());

  const path = `${userId}/${workoutId}.jpg`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (uploadErr) {
    Alert.alert('Upload failed', uploadErr.message);
    return null;
  }

  const { error: updateErr } = await supabase
    .from('workouts')
    .update({ photo_path: path })
    .eq('id', workoutId);
  if (updateErr) {
    Alert.alert('Saved photo, but failed to attach', updateErr.message);
    return null;
  }

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return { path, publicUrl };
}
