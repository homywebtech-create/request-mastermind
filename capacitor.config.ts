import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c9213afe1e6545938c572cfda087384c',
  appName: 'request-mastermind',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#FF0000",
      sound: "notification_sound.mp3", // custom notification sound
      requestPermissionsOnLaunch: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
