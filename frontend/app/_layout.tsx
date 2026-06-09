import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { I18nManager, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { colors } from '../constants/theme';

// Force RTL for Arabic on native. On web, I18nManager is a no-op.
try {
  I18nManager.allowRTL(true);
  if (!I18nManager.isRTL && Platform.OS !== 'web') {
    I18nManager.forceRTL(true);
  }
} catch {}

function TabsInner() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الصلاة',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="adhkar"
        options={{
          title: 'الأذكار',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'الإحصائيات',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'الإعدادات',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="quran"
        options={{
          href: null, // مخفي من شريط التنقل - يُفتح من صفحة الأذكار
        }}
      />
    </Tabs>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // طلب صلاحية الإشعارات عند بدء التطبيق وإعداد قنوات الأذان
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        // طلب الإذن
        await Notifications.requestPermissionsAsync();
        // إعداد معالج الإشعارات الواردة
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        // إعداد قنوات أندرويد
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('adhkar', {
            name: 'أذكار وتذكيرات',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#1a6b3c',
            sound: 'default',
          });
          await Notifications.setNotificationChannelAsync('adhan', {
            name: 'أذان الصلاة',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500, 200, 500],
            lightColor: '#d4a017',
            sound: 'default',
            enableVibrate: true,
            bypassDnd: true,
          });
        }
      } catch (e) {
        console.log('notification setup error', e);
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <TabsInner />
    </SafeAreaProvider>
  );
}
