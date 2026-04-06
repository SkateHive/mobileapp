export const APP_NAME="SkateHive";
export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
export const STORED_USERS_KEY = 'myc_users';
export const API_BASE_URL = 'https://api.skatehive.app/api/v2';
export const LEADERBOARD_API_URL = 'https://api.skatehive.app/api/v2/leaderboard';
export const HIVE_AVATAR_URL = 'https://images.hive.blog/u';

export const NAV_THEME = {
  light: {
    background: 'hsl(0 0% 100%)', // background
    border: 'hsl(240 5.9% 90%)', // border
    card: 'hsl(0 0% 100%)', // card
    notification: 'hsl(0 84.2% 60.2%)', // destructive
    primary: 'hsl(240 5.9% 10%)', // primary
    text: 'hsl(240 10% 3.9%)', // foreground
  },
  dark: {
    background: 'hsl(240 10% 3.9%)', // background
    border: 'hsl(240 3.7% 15.9%)', // border
    card: 'hsl(240 10% 3.9%)', // card
    notification: 'hsl(0 72% 51%)', // destructive
    primary: 'hsl(0 0% 98%)', // primary
    text: 'hsl(0 0% 98%)', // foreground
  },
};
