import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_RECENTS = 10;

export const getRecentSearchKey = (username: string | null) => {
  return `recents_${username || 'anonymous'}`;
};

export const getRecentSearches = async (username: string | null): Promise<string[]> => {
  try {
    const key = getRecentSearchKey(username);
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading recent searches:', error);
    return [];
  }
};

export const saveRecentSearch = async (username: string | null, query: string) => {
  if (!query || query.trim().length === 0) return;
  
  try {
    const key = getRecentSearchKey(username);
    const recents = await getRecentSearches(username);
    
    // Remove if already exists (to move it to top)
    const filtered = recents.filter(q => q.toLowerCase() !== query.toLowerCase());
    
    // Add to top
    const updated = [query, ...filtered].slice(0, MAX_RECENTS);
    
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error saving recent search:', error);
    return [];
  }
};

export const removeRecentSearch = async (username: string | null, query: string) => {
  try {
    const key = getRecentSearchKey(username);
    const recents = await getRecentSearches(username);
    const updated = recents.filter(q => q !== query);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error removing recent search:', error);
    return [];
  }
};

export const clearRecentSearches = async (username: string | null) => {
  try {
    const key = getRecentSearchKey(username);
    await AsyncStorage.removeItem(key);
    return [];
  } catch (error) {
    console.error('Error clearing recent searches:', error);
    return [];
  }
};
