import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// Login form is now embedded in the index screen.
// This redirect ensures any navigation to /login goes to the right place.
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
