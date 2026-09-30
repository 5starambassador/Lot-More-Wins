import { Redirect } from 'expo-router';
import { useSession } from '../store/session-store';

/** Entry: Scan is the home screen once signed in. */
export default function Index() {
  const { token, isRestoring } = useSession();
  if (isRestoring) return null;
  return <Redirect href={token ? '/(tabs)' : '/(auth)/login'} />;
}
