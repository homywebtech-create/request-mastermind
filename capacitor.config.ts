import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c9213afe1e6545938c572cfda087384c',
  appName: 'request-mastermind',
  webDir: 'dist',
  // Hot-reload disabled - app runs locally with full native features
  // server: {
  //   url: 'https://c9213afe-1e65-4593-8c57-2cfda087384c.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#FF0000",
      sound: "notification_sound.mp3",
      requestPermissionsOnLaunch: true,
    },
  },
};

export default config;
