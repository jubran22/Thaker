import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow } from '../constants/theme';
import { getDeviceId, getStatsSummary, getStatsRange } from '../utils/api';

type Range = 'week' | 'month' | 'year';

export default function StatsScreen() {
  const [deviceId, setDeviceId] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [range, setRange] = useState<Range>('week');
  const [rangeData, setRangeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRange = useCallback(async (id: string, r: Range) => {
    const today = new Date();
    let start = new Date();
    if (r === 'week') start.setDate(today.getDate() - 6);
    else if (r === 'month') start = new Date(today.getFullYear(), today.getMonth(), 1);
    else start = new Date(today.getFullYear(), 0, 1);
    const s = start.toISOString().slice(0, 10);
    const e = today.toISOString().slice(0, 10);
    const data = await getStatsRange(id, s, e);
    setRangeData(data);
  }, []);

  const load = useCallback(async () => {
    try {
      const id = await getDeviceId();
      setDeviceId(id);
      const s = await getStatsSummary(id);
      setSummary(s);
      await loadRange(id, range);
    } catch (e) {
      console.log('stats err', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, loadRange]);

  useEffect(() => { load(); }, [load]);

  const switchRange = async (r: Range) => {
    setRange(r);
    if (deviceId) await loadRange(deviceId, r);
  };

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const maxPrayers = Math.max(1, ...(rangeData?.per_day || []).map((d: any) => d.prayers_done));
  const days = rangeData?.per_day || [];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.title}>الإحصائيات</Text>
        <Text style={styles.subtitle}>تابع تقدمك في العبادات</Text>

        {/* STREAK */}
        <View style={styles.streakCard}>
          <View>
            <Text style={styles.streakLabel}>سلسلة المداومة</Text>
            <Text style={styles.streakNum} testID="streak-days">
              {summary?.streak_days || 0}
            </Text>
            <Text style={styles.streakSub}>يوم متتالي</Text>
          </View>
          <Ionicons name="flame" size={56} color={colors.gold} />
        </View>

        {/* KPIs */}
        <Text style={styles.sectionTitle}>اليوم</Text>
        <View style={styles.kpiRow}>
          <Kpi icon="checkmark-done" label="صلاة" value={`${summary?.today?.prayers_done || 0}/5`} color={colors.success} />
          <Kpi icon="book" label="أذكار" value={`${summary?.today?.adhkar_done || 0}/4`} color={colors.primary} />
        </View>
        <View style={styles.kpiRow}>
          <Kpi icon="repeat" label="تسبيح" value={`${summary?.today?.tasbih_count || 0}`} color={colors.gold} />
          <Kpi icon="library" label="قرآن" value={`${summary?.today?.quran_pages || 0} ص`} color="#7C3AED" />
        </View>

        {/* Range Switch */}
        <View style={styles.rangeRow}>
          {(['week', 'month', 'year'] as Range[]).map((r) => (
            <TouchableOpacity
              key={r}
              testID={`range-${r}`}
              onPress={() => switchRange(r)}
              style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
            >
              <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>
                {r === 'week' ? 'الأسبوع' : r === 'month' ? 'الشهر' : 'السنة'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Range Totals */}
        <View style={styles.totalsCard}>
          <Row label="صلوات مؤداة" value={rangeData?.totals?.prayers_done || 0} />
          <Row label="أذكار مكتملة" value={rangeData?.totals?.adhkar_done || 0} />
          <Row label="مجموع التسبيح" value={rangeData?.totals?.tasbih_count || 0} />
          <Row label="صفحات قرآن" value={rangeData?.totals?.quran_pages || 0} />
          <Row label="أيام كاملة (5 صلوات)" value={rangeData?.totals?.days_full_prayers || 0} />
        </View>

        {/* Bar chart */}
        {days.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>الصلوات لكل يوم</Text>
            <View style={styles.chart}>
              {days.slice(-14).map((d: any) => {
                const h = (d.prayers_done / 5) * 100;
                const label = d.date.slice(8, 10);
                return (
                  <View key={d.date} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${h}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{label}</Text>
                    <Text style={styles.barNum}>{d.prayers_done}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Summary overview */}
        <Text style={styles.sectionTitle}>ملخص عام</Text>
        <View style={styles.totalsCard}>
          <Row label="صلوات هذا الشهر" value={summary?.month?.prayers_done || 0} />
          <Row label="أذكار هذا الشهر" value={summary?.month?.adhkar_done || 0} />
          <Row label="صلوات هذه السنة" value={summary?.year?.prayers_done || 0} />
          <Row label="قرآن هذه السنة" value={`${summary?.year?.quran_pages || 0} ص`} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ icon, label, value, color }: any) {
  return (
    <View style={[styles.kpi, { borderRightColor: color, borderRightWidth: 4 }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowValue}>{value}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, textAlign: 'right' },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'right', marginTop: spacing.lg, marginBottom: spacing.sm },
  streakCard: {
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    ...shadow.md,
  },
  streakLabel: { color: colors.textInverseMuted, fontSize: 14, textAlign: 'right' },
  streakNum: { color: colors.textInverse, fontSize: 54, fontWeight: '800', textAlign: 'right' },
  streakSub: { color: colors.gold, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  kpiRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 10 },
  kpi: {
    flex: 1, backgroundColor: colors.card, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, ...shadow.sm,
  },
  kpiLabel: { fontSize: 13, color: colors.textSecondary, textAlign: 'right', marginTop: 6 },
  kpiValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'right' },
  rangeRow: {
    flexDirection: 'row-reverse', gap: 8, marginTop: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.elevated, padding: 4, borderRadius: radius.full,
  },
  rangeBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.full, alignItems: 'center' },
  rangeBtnActive: { backgroundColor: colors.primary },
  rangeText: { color: colors.textSecondary, fontWeight: '700' },
  rangeTextActive: { color: colors.textInverse },
  totalsCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, ...shadow.sm, marginTop: 8,
  },
  row: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  rowValue: { fontSize: 17, color: colors.primary, fontWeight: '800' },
  chart: {
    flexDirection: 'row-reverse', gap: 6, height: 140, alignItems: 'flex-end',
    backgroundColor: colors.card, padding: 12, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, ...shadow.sm,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { flex: 1, width: '70%', backgroundColor: colors.elevated, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  barLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  barNum: { fontSize: 11, color: colors.primary, fontWeight: '800' },
});
