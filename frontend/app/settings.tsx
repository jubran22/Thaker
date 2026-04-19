import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, shadow, PRAYERS_AR, PRAYER_ORDER } from '../constants/theme';
import { apiGet, aladhanDateStr, parseTime, formatTime12 } from '../utils/api';

// Dynamic import for expo-notifications (not supported in Expo Go SDK 53+).
// We only use LOCAL notifications which still work in dev/production builds.
async function getNotifications() {
  try {
    const mod = await import('expo-notifications');
    return mod;
  } catch {
    return null;
  }
}

export default function SettingsScreen() {
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [city, setCity] = useState('');
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [times, setTimes] = useState<any>(null);

  const loadAll = useCallback(async () => {
    const enabled = (await AsyncStorage.getItem('notif_enabled')) === '1';
    setNotifEnabled(enabled);
    const loc = await AsyncStorage.getItem('user_location');
    if (loc) {
      const p = JSON.parse(loc);
      setCity(p.city || '');
      try {
        const pt = await apiGet<any>(
          `/prayer-times?lat=${p.lat}&lng=${p.lng}&date=${aladhanDateStr()}`
        );
        setTimes(pt);
      } catch {}
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleNotif = async (val: boolean) => {
    if (val) {
      if (Platform.OS === 'web') {
        Alert.alert('تنبيه', 'الإشعارات تعمل فقط على بناء التطبيق الأصلي (Development Build)، وليس على Expo Go أو الويب.');
        return;
      }
      const Notifications = await getNotifications();
      if (!Notifications) {
        Alert.alert(
          'غير مدعوم في Expo Go',
          'أُزيلت الإشعارات من Expo Go بدءاً من SDK 53. استخدم Development Build لتفعيلها.'
        );
        return;
      }
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('الصلاحية مرفوضة', 'فعّل الإشعارات من إعدادات الجهاز.');
          return;
        }
        await scheduleDailyPrayerNotifications();
      } catch (e: any) {
        Alert.alert('تعذر التفعيل', e?.message || 'خطأ غير معروف');
        return;
      }
    } else {
      const Notifications = await getNotifications();
      if (Notifications) {
        try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
      }
    }
    await AsyncStorage.setItem('notif_enabled', val ? '1' : '0');
    setNotifEnabled(val);
  };

  const refreshLocation = async () => {
    setLoadingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('الصلاحية مرفوضة', 'فعّل الموقع من إعدادات الجهاز.');
        setLoadingLoc(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let cityName = 'موقعك';
      try {
        const rev = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude, longitude: loc.coords.longitude,
        });
        if (rev[0]) cityName = rev[0].city || rev[0].region || rev[0].country || cityName;
      } catch {}
      await AsyncStorage.setItem(
        'user_location',
        JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude, city: cityName })
      );
      setCity(cityName);
      const pt = await apiGet<any>(
        `/prayer-times?lat=${loc.coords.latitude}&lng=${loc.coords.longitude}&date=${aladhanDateStr()}`
      );
      setTimes(pt);
      if (notifEnabled) await scheduleDailyPrayerNotifications();
      Alert.alert('تم', 'تم تحديث الموقع بنجاح');
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'فشل تحديث الموقع');
    } finally {
      setLoadingLoc(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Text style={styles.title}>الإعدادات</Text>

        <Text style={styles.section}>الموقع</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>المدينة الحالية</Text>
              <Text style={styles.cardSub}>{city || 'غير محدد'}</Text>
            </View>
            <Ionicons name="location" size={24} color={colors.primary} />
          </View>
          <TouchableOpacity
            testID="refresh-location"
            style={styles.btn}
            onPress={refreshLocation}
            disabled={loadingLoc}
          >
            <Text style={styles.btnText}>{loadingLoc ? 'جاري التحديث...' : 'تحديث الموقع'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>الإشعارات</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>تنبيهات الصلاة</Text>
              <Text style={styles.cardSub}>إشعار عند دخول وقت كل صلاة</Text>
            </View>
            <Switch
              testID="notif-switch"
              value={notifEnabled}
              onValueChange={toggleNotif}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.card}
            />
          </View>
        </View>

        {times && (
          <>
            <Text style={styles.section}>أوقات اليوم</Text>
            <View style={styles.card}>
              {PRAYER_ORDER.map((k, idx) => (
                <View
                  key={k}
                  style={[styles.timeRow, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                >
                  <Text style={styles.timeVal}>{formatTime12(times.timings[k])}</Text>
                  <Text style={styles.timeName}>{PRAYERS_AR[k]}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.section}>عن التطبيق</Text>
        <View style={styles.card}>
          <Text style={styles.about}>
            تطبيق "مواعيد الصلاة والورد" يساعدك على الحفاظ على صلواتك وأذكارك اليومية،
            مع إحصائيات يومية وشهرية وسنوية لتتبع تقدمك.
          </Text>
          <Text style={styles.aboutSmall}>
            أوقات الصلاة عبر Aladhan API — طريقة أم القرى. تخزين البيانات محلي على جهازك.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function scheduleDailyPrayerNotifications() {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const loc = await AsyncStorage.getItem('user_location');
    if (!loc) return;
    const p = JSON.parse(loc);
    const pt = await apiGet<any>(
      `/prayer-times?lat=${p.lat}&lng=${p.lng}&date=${aladhanDateStr()}`
    );
    const timings = pt.timings;
    const now = new Date();
    for (const k of PRAYER_ORDER) {
      const d = parseTime(timings[k]);
      if (!d || d.getTime() <= now.getTime()) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `حان الآن وقت صلاة ${PRAYERS_AR[k]}`,
          body: 'لا تنسَ إتمام الصلاة وتسجيلها في التطبيق 🕌',
          sound: true,
        },
        trigger: { date: d } as any,
      });
    }
  } catch (e) {
    console.log('schedule error', e);
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.md },
  section: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, textAlign: 'right', marginTop: spacing.lg, marginBottom: 8, letterSpacing: 1 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, ...shadow.sm,
  },
  rowBetween: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },
  cardSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  btn: {
    marginTop: 12, padding: 12, borderRadius: radius.full,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  btnText: { color: colors.textInverse, fontWeight: '800' },
  timeRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4 },
  timeName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  timeVal: { fontSize: 15, color: colors.primary, fontWeight: '700' },
  about: { fontSize: 14, color: colors.textPrimary, textAlign: 'right', lineHeight: 24 },
  aboutSmall: { fontSize: 12, color: colors.textSecondary, textAlign: 'right', marginTop: 10 },
});
