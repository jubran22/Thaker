import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { colors, spacing, radius, shadow } from '../constants/theme';
import {
  MORNING_ADHKAR,
  EVENING_ADHKAR,
  AFTER_PRAYER_ADHKAR,
  SLEEP_ADHKAR,
  TASBIH_PHRASES,
  Dhikr,
} from '../constants/adhkar';
import {
  getDeviceId,
  apiGet,
  apiPost,
  apiDelete,
  todayStr,
} from '../utils/api';

type View_ = 'hub' | 'morning' | 'evening' | 'after' | 'sleep' | 'tasbih' | 'quran' | 'custom';

export default function AdhkarScreen() {
  const router = useRouter();
  const [view, setView] = useState<View_>('hub');
  const [deviceId, setDeviceId] = useState('');
  const [day, setDay] = useState<any>(null);
  const [wirds, setWirds] = useState<any[]>([]);

  const load = useCallback(async () => {
    const id = await getDeviceId();
    setDeviceId(id);
    try {
      const d = await apiGet(`/day?device_id=${id}&date=${todayStr()}`);
      setDay(d);
      const ws = await apiGet<any[]>(`/wirds?device_id=${id}`);
      setWirds(ws);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (view === 'morning')
    return <AdhkarList title="أذكار الصباح" items={MORNING_ADHKAR} onBack={() => setView('hub')} onComplete={() => markAdhkar('morning')} />;
  if (view === 'evening')
    return <AdhkarList title="أذكار المساء" items={EVENING_ADHKAR} onBack={() => setView('hub')} onComplete={() => markAdhkar('evening')} />;
  if (view === 'after')
    return <AdhkarList title="أذكار بعد الصلاة" items={AFTER_PRAYER_ADHKAR} onBack={() => setView('hub')} onComplete={() => markAdhkar('after_prayer')} />;
  if (view === 'sleep')
    return <AdhkarList title="أذكار النوم" items={SLEEP_ADHKAR} onBack={() => setView('hub')} onComplete={() => markAdhkar('sleep')} />;
  if (view === 'tasbih')
    return <TasbihScreen deviceId={deviceId} onBack={() => { setView('hub'); load(); }} />;
  if (view === 'quran')
    return <QuranScreen deviceId={deviceId} initial={day?.quran_pages || 0} onBack={() => { setView('hub'); load(); }} />;
  if (view === 'custom')
    return <CustomWirdsScreen deviceId={deviceId} onBack={() => { setView('hub'); load(); }} />;

  async function markAdhkar(kind: string) {
    try {
      await apiPost('/adhkar/toggle', {
        device_id: deviceId,
        date: todayStr(),
        adhkar_type: kind,
        completed: true,
      });
      load();
    } catch {}
    setView('hub');
  }

  const adhkar = day?.adhkar || {};

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>الأذكار والأوراد</Text>
        <Text style={styles.pageSub}>اختر الذكر لتبدأ</Text>

        <View style={styles.grid}>
          <BigCard
            testID="card-morning"
            icon="sunny"
            title="أذكار الصباح"
            subtitle={adhkar.morning ? 'تم اليوم ✓' : 'ابدأ اليوم'}
            color="#FDE68A"
            iconColor="#B45309"
            done={!!adhkar.morning}
            onPress={() => setView('morning')}
          />
          <BigCard
            testID="card-evening"
            icon="moon"
            title="أذكار المساء"
            subtitle={adhkar.evening ? 'تم اليوم ✓' : 'اختم مساءك'}
            color="#C7D2FE"
            iconColor="#3730A3"
            done={!!adhkar.evening}
            onPress={() => setView('evening')}
          />
        </View>

        <View style={styles.grid}>
          <SmallCard
            testID="card-after-prayer"
            icon="book"
            title="بعد الصلاة"
            done={!!adhkar.after_prayer}
            onPress={() => setView('after')}
          />
          <SmallCard
            testID="card-sleep"
            icon="bed"
            title="أذكار النوم"
            done={!!adhkar.sleep}
            onPress={() => setView('sleep')}
          />
        </View>

        <View style={styles.grid}>
          <SmallCard
            testID="card-tasbih"
            icon="repeat"
            title={`السبحة (${day?.tasbih_count || 0})`}
            onPress={() => setView('tasbih')}
          />
          <SmallCard
            testID="card-quran"
            icon="library"
            title={`القرآن (${day?.quran_pages || 0} ص)`}
            onPress={() => router.push('/quran')}
          />
        </View>

        <TouchableOpacity
          testID="card-custom"
          style={styles.wideCard}
          onPress={() => setView('custom')}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.wideTitle}>أورادي المخصصة</Text>
            <Text style={styles.wideSub}>
              {wirds.length > 0 ? `${wirds.length} ورد` : 'أضف وردك الخاص'}
            </Text>
          </View>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BigCard({ testID, icon, title, subtitle, color, iconColor, done, onPress }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.bigCard, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={32} color={iconColor} />
      <Text style={styles.bigTitle}>{title}</Text>
      <Text style={[styles.bigSub, done && { color: colors.success, fontWeight: '800' }]}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function SmallCard({ testID, icon, title, done, onPress }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.smallCard, done && { borderColor: colors.success, borderWidth: 2 }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text style={styles.smallTitle}>{title}</Text>
      {done && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
    </TouchableOpacity>
  );
}

function AdhkarList({ title, items, onBack, onComplete }: { title: string; items: Dhikr[]; onBack: () => void; onComplete: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const increment = (d: Dhikr) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCounts((c) => ({ ...c, [d.id]: Math.min((c[d.id] || 0) + 1, d.count) }));
  };

  const allDone = items.every((d) => (counts[d.id] || 0) >= d.count);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="adhkar-back" onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        renderItem={({ item }) => {
          const c = counts[item.id] || 0;
          const done = c >= item.count;
          return (
            <TouchableOpacity
              testID={`dhikr-${item.id}`}
              activeOpacity={0.85}
              onPress={() => increment(item)}
              style={[styles.dhikrCard, done && styles.dhikrCardDone]}
            >
              <Text style={styles.dhikrText}>{item.text}</Text>
              {item.virtue && <Text style={styles.dhikrVirtue}>فضله: {item.virtue}</Text>}
              <View style={styles.dhikrFooter}>
                <View style={[styles.countBadge, done && { backgroundColor: colors.success }]}>
                  <Text style={styles.countText}>{c} / {item.count}</Text>
                </View>
                {done && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <View style={styles.footerBar}>
        <TouchableOpacity
          testID="adhkar-complete"
          disabled={!allDone}
          onPress={onComplete}
          style={[styles.completeBtn, !allDone && { opacity: 0.4 }]}
        >
          <Text style={styles.completeText}>
            {allDone ? 'إتمام وتسجيل ✓' : 'أكمل جميع الأذكار'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function TasbihScreen({ deviceId, onBack }: { deviceId: string; onBack: () => void }) {
  const [phrase, setPhrase] = useState(0);
  const [session, setSession] = useState(0);
  const [saving, setSaving] = useState(false);

  const tap = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newCount = session + 1;
    setSession(newCount);
    try {
      await apiPost('/tasbih/add', { device_id: deviceId, date: todayStr(), count: 1 });
    } catch {}
  };

  const reset = () => setSession(0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="tasbih-back" onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>السبحة الإلكترونية</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.tasbihPhraseRow}>
        <TouchableOpacity
          testID="tasbih-prev"
          onPress={() => setPhrase((p) => (p - 1 + TASBIH_PHRASES.length) % TASBIH_PHRASES.length)}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.tasbihPhrase}>{TASBIH_PHRASES[phrase]}</Text>
        <TouchableOpacity
          testID="tasbih-next"
          onPress={() => setPhrase((p) => (p + 1) % TASBIH_PHRASES.length)}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tasbihBody}>
        <TouchableOpacity
          testID="tasbih-counter"
          activeOpacity={0.85}
          onPress={tap}
          style={styles.tasbihCircle}
        >
          <Text style={styles.tasbihCount}>{session}</Text>
          <Text style={styles.tasbihTap}>اضغط للتسبيح</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tasbihActions}>
        <TouchableOpacity testID="tasbih-reset" onPress={reset} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>تصفير العدّاد</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function QuranScreen({ deviceId, initial, onBack }: { deviceId: string; initial: number; onBack: () => void }) {
  const [pages, setPages] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async (newVal: number) => {
    setPages(Math.max(0, newVal));
    try {
      await apiPost('/quran/set', {
        device_id: deviceId,
        date: todayStr(),
        pages: Math.max(0, newVal),
      });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="quran-back" onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>قراءة القرآن</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.quranBody}>
        <Text style={styles.quranLabel}>صفحات اليوم</Text>
        <Text style={styles.quranCount} testID="quran-count">{pages}</Text>
        <View style={styles.quranBtns}>
          <TouchableOpacity
            testID="quran-minus"
            style={styles.qBtn}
            onPress={() => save(pages - 1)}
          >
            <Ionicons name="remove" size={28} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="quran-plus"
            style={[styles.qBtn, styles.qBtnPrimary]}
            onPress={() => save(pages + 1)}
          >
            <Ionicons name="add" size={32} color={colors.textInverse} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: spacing.lg }}>
          {[5, 10, 20].map((v) => (
            <TouchableOpacity
              key={v}
              testID={`quran-preset-${v}`}
              style={styles.presetBtn}
              onPress={() => save(pages + v)}
            >
              <Text style={styles.presetText}>+{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.quranHint}>ورد يومي موصى به: 4 صفحات (جزء/أسبوعين)</Text>
      </View>
    </SafeAreaView>
  );
}

function CustomWirdsScreen({ deviceId, onBack }: { deviceId: string; onBack: () => void }) {
  const [wirds, setWirds] = useState<any[]>([]);
  const [day, setDay] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('1');

  const load = useCallback(async () => {
    try {
      const ws = await apiGet<any[]>(`/wirds?device_id=${deviceId}`);
      setWirds(ws);
      const d = await apiGet(`/day?device_id=${deviceId}&date=${todayStr()}`);
      setDay(d);
    } catch {}
  }, [deviceId]);

  useEffect(() => { if (deviceId) load(); }, [deviceId, load]);

  const add = async () => {
    if (!title.trim()) return;
    try {
      await apiPost('/wirds', {
        device_id: deviceId,
        title: title.trim(),
        target: parseInt(target, 10) || 1,
      });
      setTitle(''); setTarget('1'); setShowAdd(false); load();
    } catch (e: any) {
      Alert.alert('خطأ', e.message);
    }
  };

  const inc = async (w: any) => {
    try {
      await apiPost('/wirds/log', {
        device_id: deviceId,
        date: todayStr(),
        wird_id: w.id,
        count: 1,
      });
      load();
    } catch {}
  };

  const remove = (w: any) => {
    Alert.alert('حذف', `حذف ورد "${w.title}"؟`, [
      { text: 'إلغاء' },
      {
        text: 'حذف', style: 'destructive',
        onPress: async () => {
          await apiDelete(`/wirds/${w.id}?device_id=${deviceId}`);
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="custom-back" onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-forward" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>أورادي</Text>
        <TouchableOpacity testID="custom-add" onPress={() => setShowAdd(true)} style={styles.backBtn}>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={wirds}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="add-circle-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>لا توجد أوراد بعد. اضغط + لإضافة ورد جديد.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const c = day?.custom_wirds?.[item.id] || 0;
          const done = c >= item.target;
          return (
            <View style={[styles.wirdCard, done && { borderColor: colors.success, borderWidth: 2 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.wirdTitle}>{item.title}</Text>
                <Text style={styles.wirdSub}>{c} / {item.target}</Text>
              </View>
              <TouchableOpacity testID={`wird-inc-${item.id}`} onPress={() => inc(item)} style={styles.incBtn}>
                <Ionicons name="add" size={24} color={colors.textInverse} />
              </TouchableOpacity>
              <TouchableOpacity testID={`wird-del-${item.id}`} onPress={() => remove(item)} style={{ padding: 8 }}>
                <Ionicons name="trash" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <Modal visible={showAdd} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>ورد جديد</Text>
            <TextInput
              testID="wird-title-input"
              value={title}
              onChangeText={setTitle}
              placeholder="اسم الورد (مثال: 100 صلاة على النبي)"
              style={styles.input}
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              testID="wird-target-input"
              value={target}
              onChangeText={setTarget}
              placeholder="الهدف اليومي"
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor={colors.textTertiary}
            />
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12 }}>
              <TouchableOpacity testID="wird-save" onPress={add} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.textInverse, fontWeight: '800' }}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAdd(false)} style={[styles.modalBtn, { backgroundColor: colors.elevated }]}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, textAlign: 'right' },
  pageSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.lg },
  grid: { flexDirection: 'row-reverse', gap: 12, marginBottom: 12 },
  bigCard: {
    flex: 1, borderRadius: radius.lg, padding: spacing.lg, minHeight: 140,
    justifyContent: 'space-between', ...shadow.sm,
  },
  bigTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'right', marginTop: 8 },
  bigSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'right' },
  smallCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.border, minHeight: 70, ...shadow.sm,
  },
  smallTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },
  wideCard: {
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg,
    flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4, ...shadow.md,
  },
  wideTitle: { fontSize: 17, fontWeight: '800', color: colors.textInverse, textAlign: 'right' },
  wideSub: { fontSize: 13, color: colors.textInverseMuted, textAlign: 'right', marginTop: 2 },
  header: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  backBtn: { padding: 8, borderRadius: radius.full, width: 40, alignItems: 'center' },
  dhikrCard: {
    backgroundColor: colors.card, padding: spacing.md, borderRadius: radius.lg,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border, ...shadow.sm,
  },
  dhikrCardDone: { backgroundColor: '#ECFDF5', borderColor: colors.success },
  dhikrText: { fontSize: 17, color: colors.textPrimary, lineHeight: 30, textAlign: 'right', fontWeight: '600' },
  dhikrVirtue: { fontSize: 13, color: colors.textSecondary, textAlign: 'right', marginTop: 6, fontStyle: 'italic' },
  dhikrFooter: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  countBadge: { backgroundColor: colors.gold, paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.full },
  countText: { color: colors.textInverse, fontWeight: '800', fontSize: 14 },
  footerBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md,
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
  },
  completeBtn: {
    backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.full, alignItems: 'center',
  },
  completeText: { color: colors.textInverse, fontWeight: '800', fontSize: 16 },
  tasbihPhraseRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, backgroundColor: colors.card, marginHorizontal: spacing.lg, marginTop: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  tasbihPhrase: { fontSize: 22, fontWeight: '800', color: colors.primary, flex: 1, textAlign: 'center' },
  tasbihBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tasbihCircle: {
    width: 260, height: 260, borderRadius: 130, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadow.md,
  },
  tasbihCount: { fontSize: 80, fontWeight: '800', color: colors.textInverse },
  tasbihTap: { fontSize: 14, color: colors.textInverseMuted, marginTop: 4 },
  tasbihActions: { padding: spacing.lg, alignItems: 'center' },
  secondaryBtn: {
    paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.full,
    backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.textPrimary, fontWeight: '700' },
  quranBody: { padding: spacing.lg, alignItems: 'center' },
  quranLabel: { fontSize: 14, color: colors.textSecondary, marginTop: 20 },
  quranCount: { fontSize: 96, fontWeight: '800', color: colors.primary },
  quranBtns: { flexDirection: 'row-reverse', gap: 20, marginTop: 10 },
  qBtn: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  qBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary, width: 72, height: 72, borderRadius: 36 },
  presetBtn: {
    backgroundColor: colors.goldBg, borderRadius: radius.full, paddingVertical: 10, paddingHorizontal: 20,
  },
  presetText: { color: colors.gold, fontWeight: '800', fontSize: 15 },
  quranHint: { marginTop: spacing.xl, color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: colors.textSecondary, marginTop: 10, textAlign: 'center', paddingHorizontal: 30 },
  wirdCard: {
    flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: colors.card,
    padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    marginBottom: 10, gap: 8, ...shadow.sm,
  },
  wirdTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },
  wirdSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  incBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modal: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'right', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 15,
    color: colors.textPrimary, textAlign: 'right',
  },
  modalBtn: { flex: 1, padding: 12, borderRadius: radius.full, alignItems: 'center' },
});
