import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, shadow, PRAYERS_AR, PRAYER_ORDER } from '../constants/theme';
import { SUNAN_RAWATIB } from '../constants/adhkar';
import {
  getDeviceId,
  apiGet,
  apiPost,
  todayStr,
  aladhanDateStr,
  parseTime,
  formatTime12,
  formatCountdown,
} from '../utils/api';

type PrayerTimes = {
  timings: Record<string, string>;
  hijri: any;
  gregorian: any;
  timezone?: string;
};

const HERO_IMAGE =
  'https://images.pexels.com/photos/30466249/pexels-photo-30466249.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [city, setCity] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  const [prayers, setPrayers] = useState<Record<string, boolean>>({
    fajr: false,
    dhuhr: false,
    asr: false,
    maghrib: false,
    isha: false,
  });
  const [sunnah, setSunnah] = useState<Record<string, { before: boolean; after: boolean }>>({
    fajr: { before: false, after: false },
    dhuhr: { before: false, after: false },
    asr: { before: false, after: false },
    maghrib: { before: false, after: false },
    isha: { before: false, after: false },
  });
  const [now, setNow] = useState(new Date());

  const [error, setError] = useState<string>('');

  const fetchTimesForLocation = useCallback(async (lat: number, lng: number, cityName: string) => {
    try {
      setCity(cityName);
      const date = aladhanDateStr();
      const pt = await apiGet<PrayerTimes>(
        `/prayer-times?lat=${lat}&lng=${lng}&date=${date}`
      );
      setTimes(pt);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل أوقات الصلاة');
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const id = await getDeviceId();
      setDeviceId(id);

      // 1) Load today's saved data
      try {
        const day = await apiGet<any>(`/day?device_id=${id}&date=${todayStr()}`);
        if (day?.prayers) setPrayers(day.prayers);
        if (day?.sunnah) setSunnah(day.sunnah);
      } catch {}

      // 2) Load prayer times IMMEDIATELY using saved or default location
      const saved = await AsyncStorage.getItem('user_location');
      let lat = 21.3891;
      let lng = 39.8579;
      let cityName = 'مكة المكرمة';
      if (saved) {
        try {
          const p = JSON.parse(saved);
          lat = p.lat; lng = p.lng; cityName = p.city || cityName;
        } catch {}
      }
      await fetchTimesForLocation(lat, lng, cityName);
      setLoading(false);

      // 3) In background, try to get fresh GPS location (non-blocking)
      if (!saved) {
        (async () => {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const l = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            let c = cityName;
            try {
              const rev = await Location.reverseGeocodeAsync({
                latitude: l.coords.latitude,
                longitude: l.coords.longitude,
              });
              if (rev[0]) {
                c = rev[0].city || rev[0].region || rev[0].country || c;
              }
            } catch {}
            await AsyncStorage.setItem(
              'user_location',
              JSON.stringify({ lat: l.coords.latitude, lng: l.coords.longitude, city: c })
            );
            await fetchTimesForLocation(l.coords.latitude, l.coords.longitude, c);
          } catch {}
        })();
      }
    } catch (e: any) {
      setError(e?.message || 'خطأ في التحميل');
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, [fetchTimesForLocation]);

  useEffect(() => {
    loadData();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [loadData]);

  const nextPrayer = useMemo(() => {
    if (!times) return null;
    const order: string[] = [...PRAYER_ORDER];
    for (const key of order) {
      const dt = parseTime(times.timings[key]);
      if (dt && dt.getTime() > now.getTime()) {
        return { key, date: dt };
      }
    }
    // all passed -> next day fajr
    const fajr = parseTime(times.timings.fajr);
    if (fajr) {
      const next = new Date(fajr);
      next.setDate(next.getDate() + 1);
      return { key: 'fajr', date: next };
    }
    return null;
  }, [times, now]);

  const togglePrayer = async (prayer: string) => {
    const newVal = !prayers[prayer];
    setPrayers((p) => ({ ...p, [prayer]: newVal }));
    try {
      await apiPost('/prayers/toggle', {
        device_id: deviceId,
        date: todayStr(),
        prayer,
        completed: newVal,
      });
    } catch (e: any) {
      Alert.alert('خطأ', 'تعذر حفظ الحالة');
      setPrayers((p) => ({ ...p, [prayer]: !newVal }));
    }
  };

  const toggleSunnah = async (prayer: string, kind: 'before' | 'after') => {
    const cur = sunnah[prayer]?.[kind] ?? false;
    const newVal = !cur;
    setSunnah((s) => ({ ...s, [prayer]: { ...s[prayer], [kind]: newVal } }));
    try {
      await apiPost('/sunnah/toggle', {
        device_id: deviceId,
        date: todayStr(),
        prayer,
        kind,
        completed: newVal,
      });
    } catch {
      setSunnah((s) => ({ ...s, [prayer]: { ...s[prayer], [kind]: cur } }));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]} testID="home-loading">
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!times) {
    return (
      <SafeAreaView style={[styles.center, { flex: 1, backgroundColor: colors.bg, padding: spacing.lg }]}>
        <Ionicons name="cloud-offline" size={56} color={colors.textTertiary} />
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
          تعذر تحميل أوقات الصلاة
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center' }}>
          {error || 'تحقق من اتصال الإنترنت ثم أعد المحاولة'}
        </Text>
        <TouchableOpacity
          testID="home-retry"
          onPress={() => { setLoading(true); loadData(); }}
          style={{ marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}
        >
          <Text style={{ color: colors.textInverse, fontWeight: '800' }}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const countdown = nextPrayer ? nextPrayer.date.getTime() - now.getTime() : 0;

  return (
    <View style={styles.root} testID="home-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <ImageBackground
          source={{ uri: HERO_IMAGE }}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.heroTop}>
                <View style={styles.locRow}>
                  <Ionicons name="location" size={14} color={colors.textInverse} />
                  <Text style={styles.locText} testID="home-city">{city}</Text>
                </View>
                {times?.hijri && (
                  <Text style={styles.hijri} testID="home-hijri">
                    {times.hijri.day} {times.hijri.month_ar} {times.hijri.year} هـ
                  </Text>
                )}
              </View>

              <View style={styles.heroCenter}>
                <Text style={styles.heroLabel}>الصلاة القادمة</Text>
                <Text style={styles.heroPrayer} testID="home-next-prayer">
                  {nextPrayer ? PRAYERS_AR[nextPrayer.key] : '—'}
                </Text>
                <Text style={styles.heroTime}>
                  {nextPrayer ? formatTime12(times?.timings[nextPrayer.key]) : ''}
                </Text>
                <View style={styles.countdownBox}>
                  <Text style={styles.countdownLabel}>متبقي</Text>
                  <Text style={styles.countdown} testID="home-countdown">
                    {formatCountdown(countdown)}
                  </Text>
                </View>
              </View>
            </SafeAreaView>
          </View>
        </ImageBackground>

        {/* PRAYER TRACKER */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الصلوات الخمس</Text>
          <View style={styles.prayerRow}>
            {PRAYER_ORDER.map((p) => {
              const time = formatTime12(times?.timings[p]);
              const done = !!prayers[p];
              const isNext = nextPrayer?.key === p;
              return (
                <TouchableOpacity
                  key={p}
                  testID={`prayer-card-${p}`}
                  onPress={() => togglePrayer(p)}
                  activeOpacity={0.85}
                  style={[
                    styles.prayerCard,
                    done && styles.prayerCardDone,
                    isNext && !done && styles.prayerCardNext,
                  ]}
                >
                  <Ionicons
                    name={done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={done ? colors.success : isNext ? colors.gold : colors.textTertiary}
                  />
                  <Text style={[styles.prayerName, done && { color: colors.success }]}>
                    {PRAYERS_AR[p]}
                  </Text>
                  <Text style={styles.prayerTime}>{time}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ALL TIMINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>جدول الأوقات</Text>
          <View style={styles.listCard}>
            {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((k, idx) => (
              <View
                key={k}
                style={[
                  styles.listRow,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                ]}
              >
                <Text style={styles.listTime}>
                  {formatTime12(times?.timings[k])}
                </Text>
                <Text style={styles.listName}>{PRAYERS_AR[k]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* SUNAN RAWATIB */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>السنن الرواتب</Text>
          <Text style={styles.sectionHint}>اضغط لتسجيل السنن قبل/بعد كل صلاة</Text>
          <View style={styles.listCard}>
            {PRAYER_ORDER.map((p, idx) => {
              const info = SUNAN_RAWATIB[p];
              const s = sunnah[p] || { before: false, after: false };
              // Hide prayers with no sunnah at all
              if (info.before === 0 && info.after === 0) return null;
              return (
                <View
                  key={p}
                  style={[
                    styles.sunnahRow,
                    idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                  ]}
                >
                  <Text style={styles.sunnahName}>{PRAYERS_AR[p]}</Text>
                  <View style={styles.sunnahPills}>
                    {info.after > 0 && (
                      <TouchableOpacity
                        testID={`sunnah-${p}-after`}
                        onPress={() => toggleSunnah(p, 'after')}
                        style={[styles.sunnahPill, s.after && styles.sunnahPillDone]}
                      >
                        <Ionicons
                          name={s.after ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={s.after ? colors.success : colors.textTertiary}
                        />
                        <Text style={[styles.sunnahPillText, s.after && { color: colors.success }]}>
                          بعد · {info.after}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {info.before > 0 && (
                      <TouchableOpacity
                        testID={`sunnah-${p}-before`}
                        onPress={() => toggleSunnah(p, 'before')}
                        style={[styles.sunnahPill, s.before && styles.sunnahPillDone]}
                      >
                        <Ionicons
                          name={s.before ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={s.before ? colors.success : colors.textTertiary}
                        />
                        <Text style={[styles.sunnahPillText, s.before && { color: colors.success }]}>
                          قبل · {info.before}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: spacing.xxl },
  hero: {
    width: '100%',
    minHeight: 360,
  },
  heroImage: {
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    minHeight: 360,
  },
  heroTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  locRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  locText: { color: colors.textInverse, fontSize: 14, fontWeight: '600' },
  hijri: { color: colors.textInverseMuted, fontSize: 13, fontWeight: '600' },
  heroCenter: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  heroLabel: {
    color: colors.textInverseMuted,
    fontSize: 14,
    marginBottom: 4,
    letterSpacing: 1,
  },
  heroPrayer: {
    color: colors.textInverse,
    fontSize: 44,
    fontWeight: '800',
    marginTop: 4,
  },
  heroTime: {
    color: colors.goldLight,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  countdownBox: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  countdownLabel: { color: colors.textInverseMuted, fontSize: 11 },
  countdown: {
    color: colors.textInverse,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'right',
  },
  sectionHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: -8,
    marginBottom: spacing.sm,
  },
  sunnahRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  sunnahName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sunnahPills: { flexDirection: 'row-reverse', gap: 6 },
  sunnahPill: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.elevated,
    borderWidth: 1, borderColor: colors.border,
  },
  sunnahPillDone: { backgroundColor: '#ECFDF5', borderColor: colors.success },
  sunnahPillText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  prayerRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
  prayerCard: {
    flex: 1,
    minWidth: 90,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  prayerCardDone: {
    backgroundColor: '#ECFDF5',
    borderColor: colors.success,
  },
  prayerCardNext: {
    borderColor: colors.gold,
    backgroundColor: colors.goldBg,
  },
  prayerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  prayerTime: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  listRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  listName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  listTime: { fontSize: 15, color: colors.primary, fontWeight: '700' },
});
