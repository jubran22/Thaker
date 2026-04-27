import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Alert, Platform, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, shadow, PRAYERS_AR, PRAYER_ORDER } from '../constants/theme';
import {
  fetchPrayerTimesFromAladhan,
  aladhanDateStr,
  parseTime,
  formatTime12,
  getNotifSettings,
  saveNotifSettings,
  NotifSettings,
  DEFAULT_NOTIF_SETTINGS,
} from '../utils/api';

// تحميل expo-notifications بشكل ديناميكي
async function getNotifications() {
  try {
    const mod = await import('expo-notifications');
    return mod;
  } catch {
    return null;
  }
}

// ---- مكوّن اختيار الوقت ----
function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(value.split(':')[0]);
  const [m, setM] = useState(value.split(':')[1]);

  const confirm = () => {
    const hh = String(Math.max(0, Math.min(23, parseInt(h, 10) || 0))).padStart(2, '0');
    const mm = String(Math.max(0, Math.min(59, parseInt(m, 10) || 0))).padStart(2, '0');
    onChange(`${hh}:${mm}`);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} style={styles.timePill}>
        <Ionicons name="time-outline" size={14} color={colors.primary} />
        <Text style={styles.timePillText}>{value}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>اختر الوقت</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 12, justifyContent: 'center', marginVertical: 16 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.timeLabel}>الدقيقة</Text>
                <TextInput
                  value={m}
                  onChangeText={setM}
                  keyboardType="number-pad"
                  style={styles.timeInput}
                  maxLength={2}
                />
              </View>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.textPrimary, alignSelf: 'flex-end', marginBottom: 8 }}>:</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.timeLabel}>الساعة</Text>
                <TextInput
                  value={h}
                  onChangeText={setH}
                  keyboardType="number-pad"
                  style={styles.timeInput}
                  maxLength={2}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
              <TouchableOpacity onPress={confirm} style={[styles.mBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.textInverse, fontWeight: '800' }}>تأكيد</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOpen(false)} style={[styles.mBtn, { backgroundColor: colors.elevated }]}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function SettingsScreen() {
  const [city, setCity] = useState('');
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [times, setTimes] = useState<any>(null);
  const [notif, setNotif] = useState<NotifSettings>({ ...DEFAULT_NOTIF_SETTINGS });
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    // تحميل إعدادات التنبيهات
    const ns = await getNotifSettings();
    setNotif(ns);

    // تحميل الموقع وأوقات الصلاة
    const loc = await AsyncStorage.getItem('user_location');
    if (loc) {
      const p = JSON.parse(loc);
      setCity(p.city || '');
      try {
        const pt = await fetchPrayerTimesFromAladhan(p.lat, p.lng, aladhanDateStr());
        setTimes(pt);
      } catch {}
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---- تحديث الموقع ----
  const refreshLocation = async () => {
    setLoadingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('الصلاحية مرفوضة', 'فعّل الموقع من إعدادات الجهاز.');
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
      const pt = await fetchPrayerTimesFromAladhan(loc.coords.latitude, loc.coords.longitude, aladhanDateStr());
      setTimes(pt);
      Alert.alert('تم ✓', 'تم تحديث الموقع بنجاح');
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'فشل تحديث الموقع');
    } finally {
      setLoadingLoc(false);
    }
  };

  // ---- حفظ إعدادات التنبيهات ----
  const applyNotifSettings = async (updated: NotifSettings) => {
    setNotif(updated);
    setSaving(true);
    try {
      await saveNotifSettings(updated);
      await scheduleAllNotifications(updated);
    } catch {}
    setSaving(false);
  };

  const toggleField = (field: keyof NotifSettings, val: boolean) => {
    if (val && Platform.OS === 'web') {
      Alert.alert('غير مدعوم', 'التنبيهات تعمل فقط على الأجهزة الحقيقية.');
      return;
    }
    applyNotifSettings({ ...notif, [field]: val });
  };

  const updateField = (field: keyof NotifSettings, val: any) => {
    applyNotifSettings({ ...notif, [field]: val });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <Text style={styles.pageTitle}>الإعدادات</Text>

        {/* ---- الموقع ---- */}
        <Text style={styles.section}>الموقع الجغرافي</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>المدينة الحالية</Text>
              <Text style={styles.cardSub}>{city || 'غير محدد — اضغط تحديث'}</Text>
            </View>
            <Ionicons name="location" size={26} color={colors.primary} />
          </View>
          <TouchableOpacity style={styles.btn} onPress={refreshLocation} disabled={loadingLoc}>
            <Ionicons name="refresh" size={16} color={colors.textInverse} />
            <Text style={styles.btnText}>{loadingLoc ? 'جاري التحديث...' : 'تحديث الموقع'}</Text>
          </TouchableOpacity>
        </View>

        {/* ---- أوقات الصلاة ---- */}
        {times && (
          <>
            <Text style={styles.section}>أوقات الصلاة اليوم</Text>
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

        {/* ---- تنبيهات الصلاة ---- */}
        <Text style={styles.section}>تنبيهات الصلاة</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>تنبيه عند دخول وقت الصلاة</Text>
              <Text style={styles.cardSub}>إشعار فور دخول وقت كل صلاة</Text>
            </View>
            <Switch
              value={notif.prayer_enabled}
              onValueChange={(v) => toggleField('prayer_enabled', v)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.card}
            />
          </View>

          {notif.prayer_enabled && (
            <>
              <View style={[styles.divider]} />
              <Text style={styles.cardSub}>تذكير قبل الصلاة بـ:</Text>
              <View style={styles.pillRow}>
                {[0, 5, 10, 15, 20, 30].map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => updateField('prayer_reminder_min', m)}
                    style={[styles.pill, notif.prayer_reminder_min === m && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, notif.prayer_reminder_min === m && styles.pillTextActive]}>
                      {m === 0 ? 'بدون' : `${m} د`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ---- أذكار الصباح ---- */}
        <Text style={styles.section}>أذكار الصباح</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>تذكير بأذكار الصباح</Text>
              <Text style={styles.cardSub}>إشعار يومي لقراءة أذكار الصباح</Text>
            </View>
            <Switch
              value={notif.morning_adhkar_enabled}
              onValueChange={(v) => toggleField('morning_adhkar_enabled', v)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.card}
            />
          </View>
          {notif.morning_adhkar_enabled && (
            <>
              <View style={styles.divider} />
              <View style={styles.rowBetween}>
                <TimePicker
                  value={notif.morning_adhkar_time}
                  onChange={(v) => updateField('morning_adhkar_time', v)}
                />
                <Text style={styles.cardSub}>وقت التنبيه</Text>
              </View>
            </>
          )}
        </View>

        {/* ---- أذكار المساء ---- */}
        <Text style={styles.section}>أذكار المساء</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>تذكير بأذكار المساء</Text>
              <Text style={styles.cardSub}>إشعار يومي لقراءة أذكار المساء</Text>
            </View>
            <Switch
              value={notif.evening_adhkar_enabled}
              onValueChange={(v) => toggleField('evening_adhkar_enabled', v)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.card}
            />
          </View>
          {notif.evening_adhkar_enabled && (
            <>
              <View style={styles.divider} />
              <View style={styles.rowBetween}>
                <TimePicker
                  value={notif.evening_adhkar_time}
                  onChange={(v) => updateField('evening_adhkar_time', v)}
                />
                <Text style={styles.cardSub}>وقت التنبيه</Text>
              </View>
            </>
          )}
        </View>

        {/* ---- تذكير الورد اليومي ---- */}
        <Text style={styles.section}>الورد اليومي من القرآن</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>تذكير بالورد اليومي</Text>
              <Text style={styles.cardSub}>إشعار يومي لقراءة وردك من القرآن</Text>
            </View>
            <Switch
              value={notif.wird_enabled}
              onValueChange={(v) => toggleField('wird_enabled', v)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.card}
            />
          </View>
          {notif.wird_enabled && (
            <>
              <View style={styles.divider} />
              <View style={styles.rowBetween}>
                <TimePicker
                  value={notif.wird_time}
                  onChange={(v) => updateField('wird_time', v)}
                />
                <Text style={styles.cardSub}>وقت التنبيه</Text>
              </View>
            </>
          )}
        </View>

        {saving && (
          <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 8, fontSize: 13 }}>
            جاري حفظ الإعدادات...
          </Text>
        )}

        {/* ---- عن التطبيق ---- */}
        <Text style={styles.section}>عن التطبيق</Text>
        <View style={styles.card}>
          <Text style={styles.about}>
            تطبيق "الذاكرين" يساعدك على الحفاظ على صلواتك وأذكارك اليومية وورد القرآن الكريم،
            مع إحصائيات تفصيلية لتتبع تقدمك الروحي.
          </Text>
          <Text style={styles.aboutSmall}>
            أوقات الصلاة: Aladhan API — طريقة أم القرى. جميع البيانات محفوظة محلياً على جهازك.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- جدولة جميع التنبيهات ----
async function scheduleAllNotifications(settings: NotifSettings) {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    // طلب الإذن أولاً
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('تنبيه', 'يرجى السماح للتطبيق بإرسال الإشعارات من إعدادات الجهاز');
      return;
    }

    // إعداد قناة الإشعارات لأندرويد
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'الذاكرين',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1a6b3c',
        sound: 'default',
      });
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    // دالة مساعدة لجدولة إشعار يومي متكرر
    const scheduleDailyNotif = async (title: string, body: string, hour: number, minute: number) => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
        },
        trigger: {
          type: 'daily',
          hour,
          minute,
        } as any,
      });
    };

    // تنبيهات أذكار الصباح
    if (settings.morning_adhkar_enabled) {
      const [h, m] = settings.morning_adhkar_time.split(':').map(Number);
      await scheduleDailyNotif('🌅 أذكار الصباح', 'حان وقت أذكار الصباح — ابدأ يومك بذكر الله', h, m);
    }

    // تنبيهات أذكار المساء
    if (settings.evening_adhkar_enabled) {
      const [h, m] = settings.evening_adhkar_time.split(':').map(Number);
      await scheduleDailyNotif('🌆 أذكار المساء', 'حان وقت أذكار المساء — اختم يومك بذكر الله', h, m);
    }

    // تذكير الورد اليومي
    if (settings.wird_enabled) {
      const [h, m] = settings.wird_time.split(':').map(Number);
      await scheduleDailyNotif('📖 ورد القرآن اليومي', 'لا تنسَ قراءة وردك اليومي من القرآن الكريم', h, m);
    }

    // تنبيهات أوقات الصلاة
    if (settings.prayer_enabled) {
      const loc = await AsyncStorage.getItem('user_location');
      if (loc) {
        const p = JSON.parse(loc);
        try {
          const { fetchPrayerTimesFromAladhan, aladhanDateStr, parseTime, PRAYER_ORDER: ORDER } =
            await import('../utils/api');
          const { PRAYERS_AR } = await import('../constants/theme');
          const pt = await fetchPrayerTimesFromAladhan(p.lat, p.lng, aladhanDateStr());
          const now = new Date();
          for (const k of ORDER) {
            const d = parseTime(pt.timings[k]);
            if (!d) continue;
            // تذكير قبل الصلاة
            if (settings.prayer_reminder_min > 0) {
              const pre = new Date(d.getTime() - settings.prayer_reminder_min * 60 * 1000);
              if (pre.getTime() > now.getTime()) {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `🕌 اقترب وقت صلاة ${PRAYERS_AR[k]}`,
                    body: `باقي ${settings.prayer_reminder_min} دقيقة — تهيأ للصلاة`,
                    sound: 'default',
                    ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
                  },
                  trigger: { type: 'date', date: pre } as any,
                });
              }
            }
            // إشعار دخول وقت الصلاة
            if (d.getTime() > now.getTime()) {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: `🕌 حان وقت صلاة ${PRAYERS_AR[k]}`,
                  body: 'الصلاة خير من النوم — أقم الصلاة',
                  sound: 'default',
                  ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
                },
                trigger: { type: 'date', date: d } as any,
              });
            }
          }
        } catch {}
      }
    }

    Alert.alert('✅ تم الحفظ', 'تم جدولة الإشعارات بنجاح');
  } catch (e) {
    console.log('schedule error', e);
    Alert.alert('خطأ', 'تعذّر جدولة الإشعارات، تأكد من منح الإذن للتطبيق');
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pageTitle: {
    fontSize: 28, fontWeight: '800', color: colors.textPrimary,
    textAlign: 'right', marginBottom: spacing.md,
  },
  section: {
    fontSize: 13, fontWeight: '800', color: colors.textSecondary,
    textAlign: 'right', marginTop: spacing.lg, marginBottom: 8, letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, ...shadow.sm,
  },
  rowBetween: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },
  cardSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  btn: {
    marginTop: 12, paddingVertical: 12, borderRadius: radius.full,
    backgroundColor: colors.primary, alignItems: 'center',
    flexDirection: 'row-reverse', justifyContent: 'center', gap: 8,
  },
  btnText: { color: colors.textInverse, fontWeight: '800', fontSize: 14 },
  timeRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 4,
  },
  timeName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  timeVal: { fontSize: 15, color: colors.primary, fontWeight: '700' },
  pillRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  pillTextActive: { color: colors.textInverse },
  timePill: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: colors.elevated, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.primary,
  },
  timePillText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  about: { fontSize: 14, color: colors.textPrimary, textAlign: 'right', lineHeight: 24 },
  aboutSmall: { fontSize: 12, color: colors.textSecondary, textAlign: 'right', marginTop: 10 },
  // نافذة اختيار الوقت
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.lg, width: '100%', maxWidth: 360,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'right', marginBottom: 4 },
  timeLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: '700' },
  timeInput: {
    borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 28,
    color: colors.textPrimary, textAlign: 'center', width: 80,
  },
  mBtn: { flex: 1, padding: 12, borderRadius: radius.full, alignItems: 'center' },
});
