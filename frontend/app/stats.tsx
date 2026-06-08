import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow } from '../constants/theme';
import {
  getDeviceId,
  getStatsSummary,
  getStatsRange,
  todayStr,
} from '../utils/api';

type RangeType = 'week' | 'month' | 'year';

function getRangeDates(range: RangeType): [string, string] {
  const today = new Date();
  const end = todayStr();
  let start: string;
  if (range === 'week') {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    start = d.toISOString().split('T')[0];
  } else if (range === 'month') {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    start = d.toISOString().split('T')[0];
  } else {
    const d = new Date(today);
    d.setDate(d.getDate() - 364);
    start = d.toISOString().split('T')[0];
  }
  return [start, end];
}

export default function StatsScreen() {
  const [deviceId, setDeviceId] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [range, setRange] = useState<RangeType>('month');
  const [rangeData, setRangeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const id = await getDeviceId();
      setDeviceId(id);
      const dates = getRangeDates(range);
      const [s, r] = await Promise.all([
        getStatsSummary(id),
        getStatsRange(id, dates[0], dates[1]),
      ]);
      setSummary(s);
      setRangeData(r);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [range]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const onRefresh = () => { setRefreshing(true); loadStats(); };

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const today = summary?.today || {};
  const totals = rangeData?.totals || {};
  const streak = summary?.streak_days || 0;
  const rangeLabel = range === 'week' ? 'آخر 7 أيام' : range === 'month' ? 'آخر 30 يوماً' : 'آخر سنة';

  const totalPrayersDone = totals.prayers_done || 0;
  const masjidPct = totalPrayersDone > 0 ? Math.round((totals.prayers_masjid || 0) / totalPrayersDone * 100) : 0;
  const homePct = totalPrayersDone > 0 ? Math.round((totals.prayers_home || 0) / totalPrayersDone * 100) : 0;
  const qadaaPct = totalPrayersDone > 0 ? Math.round((totals.prayers_qadaa || 0) / totalPrayersDone * 100) : 0;
  const otherPct = 100 - masjidPct - homePct - qadaaPct;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>الملخص العام</Text>
        <Text style={styles.pageSub}>إحصائياتك اليومية والدورية</Text>

        {/* بطاقة السلسلة */}
        <View style={styles.streakCard}>
          <View style={styles.streakLeft}>
            <Text style={styles.streakNum} testID="streak-days">{streak}</Text>
            <Text style={styles.streakLabel}>يوم متواصل</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakRight}>
            <Text style={styles.streakTitle}>سلسلة الإنجاز</Text>
            <Text style={styles.streakSub}>
              {streak >= 30 ? 'ماشاء الله! شهر متواصل' :
               streak >= 7 ? 'ماشاء الله! أسبوع متواصل' :
               streak >= 3 ? 'أحسنت! استمر' :
               streak > 0 ? 'بداية جيدة، واصل' : 'ابدأ اليوم'}
            </Text>
          </View>
        </View>

        {/* اليوم الحالي */}
        <Text style={styles.sectionTitle}>اليوم</Text>
        <View style={styles.kpiRow}>
          <KpiCard
            icon="checkmark-circle"
            iconColor="#16A34A"
            value={today.prayers_done || 0}
            max={5}
            label="صلوات"
          />
          <KpiCard
            icon="moon"
            iconColor="#0284C7"
            value={today.fasting ? 1 : 0}
            max={1}
            label="صيام"
            isFasting
          />
          <KpiCard
            icon="sunny"
            iconColor="#D97706"
            value={today.adhkar_done || 0}
            max={4}
            label="أذكار"
          />
          <KpiCard
            icon="book"
            iconColor="#7C3AED"
            value={today.quran_pages || 0}
            label="صفحات"
          />
        </View>

        {/* حالة صلوات اليوم */}
        <Text style={styles.sectionTitle}>حالة صلوات اليوم</Text>
        <View style={styles.prayerStatusRow}>
          <PrayerStatusBadge
            icon="business"
            color="#16A34A"
            label="مسجد"
            count={today.prayers_masjid || 0}
          />
          <PrayerStatusBadge
            icon="home"
            color="#2563EB"
            label="بيت"
            count={today.prayers_home || 0}
          />
          <PrayerStatusBadge
            icon="time"
            color="#EA580C"
            label="قضاء"
            count={today.prayers_qadaa || 0}
          />
          <PrayerStatusBadge
            icon="ellipse-outline"
            color={colors.textTertiary}
            label="غير محدد"
            count={Math.max(0, (today.prayers_done || 0) - (today.prayers_masjid || 0) - (today.prayers_home || 0) - (today.prayers_qadaa || 0))}
          />
        </View>

        {/* مبدّل النطاق */}
        <View style={styles.rangePills}>
          {(['week', 'month', 'year'] as RangeType[]).map((r) => (
            <TouchableOpacity
              key={r}
              testID={`range-${r}`}
              style={[styles.rangePill, range === r && styles.rangePillActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.rangePillText, range === r && styles.rangePillTextActive]}>
                {r === 'week' ? 'أسبوع' : r === 'month' ? 'شهر' : 'سنة'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{rangeLabel}</Text>

        {/* بطاقة الصلوات */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>الصلوات</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statValue}>{totalPrayersDone}</Text>
            <Text style={styles.statLabel}>إجمالي الصلوات المؤداة</Text>
          </View>

          {totalPrayersDone > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.barContainer}>
                {masjidPct > 0 && (
                  <View style={[styles.barSegment, { flex: masjidPct, backgroundColor: '#16A34A' }]} />
                )}
                {homePct > 0 && (
                  <View style={[styles.barSegment, { flex: homePct, backgroundColor: '#2563EB' }]} />
                )}
                {qadaaPct > 0 && (
                  <View style={[styles.barSegment, { flex: qadaaPct, backgroundColor: '#EA580C' }]} />
                )}
                {otherPct > 0 && (
                  <View style={[styles.barSegment, { flex: otherPct, backgroundColor: colors.border }]} />
                )}
              </View>
              <View style={styles.barLegend}>
                <LegendItem color="#16A34A" label="مسجد" count={totals.prayers_masjid || 0} pct={masjidPct} />
                <LegendItem color="#2563EB" label="بيت" count={totals.prayers_home || 0} pct={homePct} />
                <LegendItem color="#EA580C" label="قضاء" count={totals.prayers_qadaa || 0} pct={qadaaPct} />
              </View>
            </>
          )}

          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Text style={[styles.statValue, { color: colors.success }]}>{totals.days_full_prayers || 0}</Text>
            <Text style={styles.statLabel}>يوم بصلوات كاملة (5/5)</Text>
          </View>
        </View>

        {/* بطاقة الصيام */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={{ fontSize: 20 }}>🌙</Text>
            <Text style={styles.cardTitle}>الصيام</Text>
          </View>
          <View style={styles.fastingRow}>
            <View style={styles.fastingBig}>
              <Text style={styles.fastingNum}>{totals.days_fasting || 0}</Text>
              <Text style={styles.fastingLabel}>يوم صيام</Text>
            </View>
            <View style={styles.fastingInfo}>
              <Text style={styles.fastingHint}>
                {(totals.days_fasting || 0) >= 3
                  ? 'أحسنت! واصل صيام الأيام البيض'
                  : 'صيام الأيام البيض: 13، 14، 15 من كل شهر هجري'}
              </Text>
            </View>
          </View>
        </View>

        {/* بطاقة السنن الرواتب */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="star" size={20} color="#D97706" />
            <Text style={styles.cardTitle}>السنن الرواتب</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statValue, { color: '#D97706' }]}>{totals.sunnah_done || 0}</Text>
            <Text style={styles.statLabel}>سنة راتبة مؤداة</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.twoColStats}>
            <StatBox icon="star" color="#D97706" value={today.sunnah_done || 0} label="سنن اليوم" />
            <StatBox icon="star-outline" color="#92400E" value={totals.sunnah_done || 0} label={rangeLabel} />
          </View>
          <View style={styles.divider} />
          <Text style={[styles.statLabel, { textAlign: 'right', fontSize: 12, color: colors.textTertiary }]}>
            السنن الرواتب: فجر 2 قبل · ظهر 4+2 · مغرب 2 · عشاء 2
          </Text>
        </View>

        {/* بطاقة الأذكار والقرآن */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="sunny" size={20} color={colors.gold} />
            <Text style={styles.cardTitle}>الأذكار والقرآن</Text>
          </View>
          <View style={styles.twoColStats}>
            <StatBox icon="sunny" color="#D97706" value={totals.adhkar_done || 0} label="أذكار" />
            <StatBox icon="repeat" color={colors.primary} value={totals.tasbih_count || 0} label="تسبيحة" />
            <StatBox icon="book" color="#7C3AED" value={totals.quran_pages || 0} label="صفحة قرآن" />
            <StatBox icon="calendar" color="#0891B2" value={totals.days_tracked || 0} label="يوم مسجّل" />
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- مكوّنات مساعدة ----

function KpiCard({ icon, iconColor, value, max, label, isFasting }: any) {
  const pct = max ? Math.min(value / max, 1) : 0;
  return (
    <View style={kpiStyles.card}>
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={kpiStyles.value}>{isFasting ? (value ? 'صائم' : '—') : value}</Text>
      {max && !isFasting && (
        <View style={kpiStyles.bar}>
          <View style={[kpiStyles.fill, { width: `${pct * 100}%` as any, backgroundColor: iconColor }]} />
        </View>
      )}
      <Text style={kpiStyles.label}>{label}</Text>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  value: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  bar: {
    width: '100%', height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});

function PrayerStatusBadge({ icon, color, label, count }: any) {
  return (
    <View style={[psbStyles.badge, { borderColor: color + '40' }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[psbStyles.count, { color }]}>{count}</Text>
      <Text style={psbStyles.label}>{label}</Text>
    </View>
  );
}

const psbStyles = StyleSheet.create({
  badge: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.card,
    gap: 3,
    ...shadow.sm,
  },
  count: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});

function LegendItem({ color, label, count, pct }: any) {
  return (
    <View style={legendStyles.item}>
      <View style={[legendStyles.dot, { backgroundColor: color }]} />
      <Text style={legendStyles.label}>{label}</Text>
      <Text style={legendStyles.count}>{count} ({pct}%)</Text>
    </View>
  );
}

const legendStyles = StyleSheet.create({
  item: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  count: { fontSize: 11, color: colors.textTertiary },
});

function StatBox({ icon, color, value, label }: any) {
  return (
    <View style={sbStyles.box}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={sbStyles.value}>{value}</Text>
      <Text style={sbStyles.label}>{label}</Text>
    </View>
  );
}

const sbStyles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.elevated,
    gap: 4,
    minWidth: '45%',
  },
  value: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, textAlign: 'right' },
  pageSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.lg },

  streakCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  streakLeft: { alignItems: 'center', minWidth: 70 },
  streakNum: { fontSize: 48, fontWeight: '800', color: colors.textInverse },
  streakLabel: { fontSize: 12, color: colors.textInverseMuted, fontWeight: '600' },
  streakDivider: {
    width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.md,
  },
  streakRight: { flex: 1 },
  streakTitle: { fontSize: 18, fontWeight: '800', color: colors.textInverse, textAlign: 'right' },
  streakSub: { fontSize: 13, color: colors.textInverseMuted, textAlign: 'right', marginTop: 4 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'right',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  kpiRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: spacing.sm },

  prayerStatusRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: spacing.sm,
  },

  rangePills: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginVertical: spacing.md,
    justifyContent: 'center',
  },
  rangePill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangePillText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  rangePillTextActive: { color: colors.textInverse },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },

  statRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },

  barContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginVertical: 8,
    backgroundColor: colors.border,
  },
  barSegment: { height: '100%' },
  barLegend: {
    flexDirection: 'row-reverse',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 4,
  },

  fastingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
  },
  fastingBig: { alignItems: 'center', minWidth: 80 },
  fastingNum: { fontSize: 44, fontWeight: '800', color: '#0284C7' },
  fastingLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  fastingInfo: { flex: 1 },
  fastingHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },

  twoColStats: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
});
