import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '~/lib/auth-provider';

// This component serves as a home redirect that always goes to feed
export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      // Always redirect to feed when hitting this route
      router.replace('/(tabs)/feed');
    } else {
      // Not authenticated, go to login
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  // Return null as this is just a redirect component
  return null;
}
