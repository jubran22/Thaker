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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, shadow, PRAYERS_AR, PRAYER_ORDER } from '../constants/theme';
import { SUNAN_RAWATIB } from '../constants/adhkar';
import {
  getDeviceId,
  getDay,
  togglePrayer as localTogglePrayer,
  toggleSunnah as localToggleSunnah,
  setPrayerStatus as localSetPrayerStatus,
  fetchPrayerTimes,
  PrayerTimes,
  PrayerStatus,
  todayStr,
  aladhanDateStr,
  parseTime,
  formatTime12,
  formatCountdown,
} from '../utils/api';

const HERO_IMAGE =
  'https://images.pexels.com/photos/30466249/pexels-photo-30466249.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

// ألوان حالة الصلاة
const STATUS_COLORS: Record<PrayerStatus, string> = {
  none: colors.textTertiary,
  masjid: '#16A34A',   // أخضر
  home: '#2563EB',     // أزرق
  qadaa: '#EA580C',    // برتقالي
};

const STATUS_ICONS: Record<PrayerStatus, string> = {
  none: 'ellipse-outline',
  masjid: 'business',
  home: 'home',
  qadaa: 'time',
};

const STATUS_LABELS: Record<PrayerStatus, string> = {
  none: 'لم تُصلَّ',
  masjid: 'مسجد',
  home: 'بيت',
  qadaa: 'قضاء',
};

export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [hijriDate, setHijriDate] = useState<{ day: string; month_ar: string; year: string } | null>(null);
  const [city, setCity] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  const [prayers, setPrayers] = useState<Record<string, boolean>>({
    fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false,
  });
  const [prayerStatus, setPrayerStatus] = useState<Record<string, PrayerStatus>>({
    fajr: 'none', dhuhr: 'none', asr: 'none', maghrib: 'none', isha: 'none',
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

  // Modal حالة الصلاة
  const [statusModal, setStatusModal] = useState<{ visible: boolean; prayer: string }>({
    visible: false,
    prayer: '',
  });

  // ---- جلب أوقات الصلاة مباشرة من Aladhan ----
  const fetchTimesForLocation = useCallback(async (lat: number, lng: number, cityName: string) => {
    try {
      setCity(cityName);
      const pt = await fetchPrayerTimes(lat, lng, aladhanDateStr());
      setTimes(pt);
      if (pt.date?.hijri) {
        setHijriDate({
          day: pt.date.hijri.date.split('-')[0],
          month_ar: pt.date.hijri.month.ar,
          year: pt.date.hijri.year,
        });
      }
      setError('');
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل أوقات الصلاة');
    }
  }, []);

  // ---- تحديث الموقع الجغرافي ----
  const refreshLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('لم يتم منح إذن الموقع');
        return;
      }
      const l = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      let c = city || 'موقعي';
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
    } catch (e: any) {
      setError('فشل تحديث الموقع: ' + (e?.message || ''));
    }
  }, [city, fetchTimesForLocation]);

  // ---- تحميل البيانات الرئيسية ----
  const loadData = useCallback(async () => {
    try {
      const id = await getDeviceId();
      setDeviceId(id);

      const day = await getDay(id, todayStr());
      if (day?.prayers) setPrayers(day.prayers);
      if (day?.prayer_status) setPrayerStatus(day.prayer_status);
      if (day?.sunnah) setSunnah(day.sunnah);

      const saved = await AsyncStorage.getItem('user_location');
      let lat = 21.3891;
      let lng = 39.8579;
      let cityName = 'مكة المكرمة';
      if (saved) {
        try {
          const p = JSON.parse(saved);
          lat = p.lat;
          lng = p.lng;
          cityName = p.city || cityName;
        } catch {}
      }
      await fetchTimesForLocation(lat, lng, cityName);
      setLoading(false);

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
    const fajr = parseTime(times.timings.fajr);
    if (fajr) {
      const next = new Date(fajr);
      next.setDate(next.getDate() + 1);
      return { key: 'fajr', date: next };
    }
    return null;
  }, [times, now]);

  // ---- تبديل حالة الصلاة (تأشير/إلغاء) ----
  const togglePrayer = async (prayer: string) => {
    const newVal = !prayers[prayer];
    setPrayers((p) => ({ ...p, [prayer]: newVal }));
    if (!newVal) {
      setPrayerStatus((s) => ({ ...s, [prayer]: 'none' }));
    }
    await localTogglePrayer(deviceId, todayStr(), prayer, newVal);
  };

  // ---- تعيين حالة الصلاة (مسجد/بيت/قضاء) ----
  const handleSetStatus = async (prayer: string, status: PrayerStatus) => {
    setPrayerStatus((s) => ({ ...s, [prayer]: status }));
    if (status !== 'none') {
      setPrayers((p) => ({ ...p, [prayer]: true }));
    }
    setStatusModal({ visible: false, prayer: '' });
    await localSetPrayerStatus(deviceId, todayStr(), prayer, status);
  };

  // ---- تبديل السنة الراتبة ----
  const toggleSunnah = async (prayer: string, kind: 'before' | 'after') => {
    const cur = sunnah[prayer]?.[kind] ?? false;
    const newVal = !cur;
    setSunnah((s) => ({ ...s, [prayer]: { ...s[prayer], [kind]: newVal } }));
    await localToggleSunnah(deviceId, todayStr(), prayer, kind, newVal);
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

  // ترتيب الصلوات: صف أول (فجر يمين + ظهر يسار)، صف ثانٍ (عصر + مغرب + عشاء)
  const row1 = ['fajr', 'dhuhr'];
  const row2 = ['asr', 'maghrib', 'isha'];

  const renderPrayerCard = (p: string) => {
    const time = formatTime12(times?.timings[p]);
    const done = !!prayers[p];
    const isNext = nextPrayer?.key === p;
    const status = (prayerStatus[p] || 'none') as PrayerStatus;
    const statusColor = STATUS_COLORS[status];
    const statusIcon = STATUS_ICONS[status] as any;

    return (
      <View key={p} style={styles.prayerCardWrapper}>
        {/* بطاقة الصلاة الرئيسية */}
        <TouchableOpacity
          testID={`prayer-card-${p}`}
          onPress={() => togglePrayer(p)}
          onLongPress={() => setStatusModal({ visible: true, prayer: p })}
          activeOpacity={0.85}
          style={[
            styles.prayerCard,
            done && { backgroundColor: '#ECFDF5', borderColor: statusColor },
            isNext && !done && styles.prayerCardNext,
          ]}
        >
          <Ionicons
            name={done ? statusIcon : 'ellipse-outline'}
            size={26}
            color={done ? statusColor : isNext ? colors.gold : colors.textTertiary}
          />
          <Text style={[styles.prayerName, done && { color: statusColor }]}>
            {PRAYERS_AR[p]}
          </Text>
          <Text style={styles.prayerTime}>{time}</Text>
          {/* شارة الحالة */}
          {done && status !== 'none' && (
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {STATUS_LABELS[status]}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {/* زر تغيير الحالة */}
        <TouchableOpacity
          style={styles.statusBtn}
          onPress={() => setStatusModal({ visible: true, prayer: p })}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-down" size={12} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    );
  };

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
                <TouchableOpacity style={styles.locRow} onPress={refreshLocation}>
                  <Ionicons name="location" size={14} color={colors.textInverse} />
                  <Text style={styles.locText} testID="home-city">{city}</Text>
                  <Ionicons name="refresh" size={12} color={colors.textInverseMuted} style={{ marginRight: 2 }} />
                </TouchableOpacity>
                {hijriDate && (
                  <Text style={styles.hijri} testID="home-hijri">
                    {hijriDate.day} {hijriDate.month_ar} {hijriDate.year} هـ
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>الصلوات الخمس</Text>
            <Text style={styles.sectionHint}>اضغط لتأشير · اضغط مطولاً لتحديد الحالة</Text>
          </View>
          {/* الصف الأول: فجر + ظهر */}
          <View style={styles.prayerRow}>
            {row1.map(renderPrayerCard)}
          </View>
          {/* الصف الثاني: عصر + مغرب + عشاء */}
          <View style={[styles.prayerRow, { marginTop: 8 }]}>
            {row2.map(renderPrayerCard)}
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
          <Text style={styles.sectionHintSub}>اضغط لتسجيل السنن قبل/بعد كل صلاة</Text>
          <View style={styles.listCard}>
            {PRAYER_ORDER.map((p, idx) => {
              const info = SUNAN_RAWATIB[p];
              const s = sunnah[p] || { before: false, after: false };
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

      {/* Modal حالة الصلاة */}
      <Modal
        visible={statusModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModal({ visible: false, prayer: '' })}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setStatusModal({ visible: false, prayer: '' })}
        >
          <Pressable style={styles.modalBox} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              حالة صلاة {PRAYERS_AR[statusModal.prayer] || ''}
            </Text>
            <Text style={styles.modalSubtitle}>اختر كيف أديت هذه الصلاة</Text>

            {(['masjid', 'home', 'qadaa', 'none'] as PrayerStatus[]).map((s) => {
              const isSelected = prayerStatus[statusModal.prayer] === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusOption,
                    isSelected && { backgroundColor: STATUS_COLORS[s] + '18', borderColor: STATUS_COLORS[s] },
                  ]}
                  onPress={() => handleSetStatus(statusModal.prayer, s)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={STATUS_ICONS[s] as any}
                    size={22}
                    color={STATUS_COLORS[s]}
                  />
                  <Text style={[styles.statusOptionText, { color: STATUS_COLORS[s] }]}>
                    {s === 'masjid' ? '🕌 في المسجد' :
                     s === 'home' ? '🏠 في البيت' :
                     s === 'qadaa' ? '⏰ قضاء' : '✕ إلغاء التأشير'}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color={STATUS_COLORS[s]} style={{ marginRight: 'auto' as any }} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setStatusModal({ visible: false, prayer: '' })}
            >
              <Text style={styles.modalCancelText}>إغلاق</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: spacing.xxl },
  hero: { width: '100%', minHeight: 360 },
  heroImage: { borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
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
  heroCenter: { alignItems: 'center', marginTop: spacing.xl },
  heroLabel: { color: colors.textInverseMuted, fontSize: 14, marginBottom: 4, letterSpacing: 1 },
  heroPrayer: { color: colors.textInverse, fontSize: 44, fontWeight: '800', marginTop: 4 },
  heroTime: { color: colors.goldLight, fontSize: 22, fontWeight: '700', marginTop: 4 },
  countdownBox: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  countdownLabel: { color: colors.textInverseMuted, fontSize: 11 },
  countdown: { color: colors.textInverse, fontSize: 26, fontWeight: '800', letterSpacing: 2, marginTop: 2 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'right' },
  sectionHint: { fontSize: 11, color: colors.textTertiary, textAlign: 'left' },
  sectionHintSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'right', marginTop: -8, marginBottom: spacing.sm },
  prayerRow: { flexDirection: 'row-reverse', gap: 8 },
  prayerCardWrapper: { flex: 1, alignItems: 'center', gap: 4 },
  prayerCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.sm,
  },
  prayerCardNext: { borderColor: colors.gold, backgroundColor: colors.goldBg },
  prayerName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  prayerTime: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  statusBtn: {
    paddingVertical: 2,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 32,
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  statusOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  statusOptionText: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  modalCancel: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: colors.elevated,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
