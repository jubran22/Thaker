import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ProgressBarAndroid,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, shadow } from '../constants/theme';
import {
  getDeviceId,
  getQuranBookmark,
  saveQuranBookmark,
  getKhatmaBookmark,
  saveKhatmaBookmark,
  getWirdPlan,
  saveWirdPlan,
  isQuranDownloaded,
  setQuranDownloaded,
  getTodayTargetPage,
  WIRD_PRESETS,
  WirdPlan,
  todayStr,
} from '../utils/api';

const { width, height } = Dimensions.get('window');
const TOTAL_PAGES = 604;

// مصدر صور المصحف - GitHub CDN
const pageUrl = (p: number) =>
  `https://raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/${String(p).padStart(3, '0')}.png`;

// مجلد التخزين المحلي
const QURAN_DIR = FileSystem.documentDirectory + 'quran_pages/';

// رابط الصورة: محلي إذا محمّل، وإلا من الإنترنت
const getPageUri = (p: number, downloaded: boolean) => {
  if (downloaded) {
    return QURAN_DIR + `${String(p).padStart(3, '0')}.png`;
  }
  return pageUrl(p);
};

export default function QuranScreen() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpVal, setJumpVal] = useState('');
  const [chromeVisible, setChromeVisible] = useState(true);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showWirdModal, setShowWirdModal] = useState(false);
  const [wirdPlan, setWirdPlan] = useState<WirdPlan | null>(null);
  const [khatmaPage, setKhatmaPage] = useState(1);
  const [customPages, setCustomPages] = useState('');
  const [todayTarget, setTodayTarget] = useState<{ from: number; to: number } | null>(null);
  const listRef = useRef<FlatList>(null);
  const downloadAbortRef = useRef(false);

  const load = useCallback(async () => {
    const id = await getDeviceId();
    setDeviceId(id);

    // تحقق من التحميل
    const dl = await isQuranDownloaded();
    setDownloaded(dl);

    // علامة القراءة العادية
    try {
      const bm = await getQuranBookmark(id);
      const p = Math.max(1, Math.min(TOTAL_PAGES, Number(bm?.page) || 1));
      setPage(p);
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: p - 1, animated: false });
      }, 100);
    } catch {}

    // خطة الورد
    const plan = await getWirdPlan(id);
    setWirdPlan(plan);
    if (plan) {
      setTodayTarget(getTodayTargetPage(plan));
    }

    // علامة الختمة
    const km = await getKhatmaBookmark(id);
    setKhatmaPage(km);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---- حفظ علامة القراءة العادية ----
  const saveReadingBookmark = async (p: number) => {
    try {
      await saveQuranBookmark(deviceId, p);
      Alert.alert('تم الحفظ ✓', `تم حفظ علامة القراءة عند الصفحة ${p}`);
    } catch {
      Alert.alert('خطأ', 'تعذر حفظ العلامة');
    }
  };

  // ---- حفظ علامة الختمة ----
  const saveKhatma = async () => {
    await saveKhatmaBookmark(deviceId, page);
    setKhatmaPage(page);
    Alert.alert('تم ✓', `تم حفظ موضع الختمة عند الصفحة ${page}`);
  };

  // ---- الانتقال لصفحة ----
  const jumpTo = () => {
    const n = parseInt(jumpVal, 10);
    if (isNaN(n) || n < 1 || n > TOTAL_PAGES) {
      Alert.alert('رقم غير صحيح', `أدخل رقماً بين 1 و ${TOTAL_PAGES}`);
      return;
    }
    listRef.current?.scrollToIndex({ index: n - 1, animated: false });
    setPage(n);
    setJumpOpen(false);
    setJumpVal('');
  };

  // ---- تحميل المصحف ----
  const startDownload = async () => {
    setShowDownloadModal(false);
    setDownloading(true);
    downloadAbortRef.current = false;

    try {
      // إنشاء المجلد
      const dirInfo = await FileSystem.getInfoAsync(QURAN_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(QURAN_DIR, { intermediates: true });
      }

      let count = 0;
      for (let p = 1; p <= TOTAL_PAGES; p++) {
        if (downloadAbortRef.current) break;

        const filePath = QURAN_DIR + `${String(p).padStart(3, '0')}.png`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (!fileInfo.exists) {
          try {
            await FileSystem.downloadAsync(pageUrl(p), filePath);
          } catch {
            // تجاهل أخطاء الصفحات الفردية
          }
        }

        count++;
        setDownloadedCount(count);
        setDownloadProgress(count / TOTAL_PAGES);
      }

      if (!downloadAbortRef.current) {
        await setQuranDownloaded(true);
        setDownloaded(true);
        Alert.alert('اكتمل التحميل ✓', 'تم تحميل المصحف الكريم بنجاح. يمكنك الآن قراءته بدون إنترنت.');
      }
    } catch (e: any) {
      Alert.alert('خطأ في التحميل', e?.message || 'تعذر تحميل المصحف');
    } finally {
      setDownloading(false);
    }
  };

  const cancelDownload = () => {
    downloadAbortRef.current = true;
    setDownloading(false);
    Alert.alert('تم الإلغاء', 'تم إلغاء تحميل المصحف');
  };

  // ---- حذف المصحف المحمّل ----
  const deleteDownload = async () => {
    Alert.alert(
      'حذف المصحف المحمّل',
      'هل تريد حذف نسخة المصحف المحفوظة على جهازك؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(QURAN_DIR, { idempotent: true });
              await setQuranDownloaded(false);
              setDownloaded(false);
            } catch {}
          },
        },
      ]
    );
  };

  // ---- حفظ خطة الورد ----
  const saveWird = async (preset: typeof WIRD_PRESETS[0], customPagesVal?: number) => {
    const pagesPerDay = preset.type === 'custom'
      ? (customPagesVal || parseInt(customPages, 10) || 2)
      : preset.pages_per_day;

    const plan: WirdPlan = {
      type: preset.type,
      pages_per_day: pagesPerDay,
      label: preset.type === 'custom' ? `${pagesPerDay} صفحات يومياً` : preset.label,
      start_date: todayStr(),
      khatma_bookmark: khatmaPage,
    };

    await saveWirdPlan(deviceId, plan);
    setWirdPlan(plan);
    setTodayTarget(getTodayTargetPage(plan));
    setShowWirdModal(false);
    Alert.alert('تم ✓', `تم ضبط الورد: ${plan.label}`);
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // ---- شاشة التحميل ----
  if (downloading) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Ionicons name="book" size={64} color={colors.primary} />
        <Text style={styles.dlTitle}>جاري تحميل المصحف الكريم</Text>
        <Text style={styles.dlSub}>{downloadedCount} / {TOTAL_PAGES} صفحة</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${downloadProgress * 100}%` }]} />
        </View>
        <Text style={styles.dlPct}>{Math.round(downloadProgress * 100)}%</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={cancelDownload}>
          <Text style={styles.cancelBtnText}>إلغاء التحميل</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1)}
        keyExtractor={(p) => String(p)}
        horizontal
        pagingEnabled
        initialNumToRender={1}
        windowSize={3}
        maxToRenderPerBatch={2}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(idx + 1);
        }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setChromeVisible((v) => !v)}
            style={styles.pageWrap}
          >
            <Image
              source={{ uri: getPageUri(item, downloaded) }}
              style={styles.pageImg}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
      />

      {chromeVisible && (
        <>
          {/* شريط علوي */}
          <SafeAreaView edges={['top']} style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="close" size={26} color={colors.textInverse} />
            </TouchableOpacity>

            <View style={styles.pagePill}>
              <Text style={styles.pagePillText}>صفحة {page} / {TOTAL_PAGES}</Text>
            </View>

            {/* زر علامة القراءة */}
            <TouchableOpacity onPress={() => saveReadingBookmark(page)} style={styles.iconBtn}>
              <Ionicons name="bookmark" size={22} color={colors.gold} />
            </TouchableOpacity>
          </SafeAreaView>

          {/* شريط الورد اليومي */}
          {todayTarget && (
            <View style={styles.wirdBar}>
              <Text style={styles.wirdBarText}>
                ورد اليوم: صفحة {todayTarget.from} — {todayTarget.to}
              </Text>
              {page >= todayTarget.from && page <= todayTarget.to && (
                <View style={styles.wirdBadge}>
                  <Text style={styles.wirdBadgeText}>أنت في الورد ✓</Text>
                </View>
              )}
            </View>
          )}

          {/* شريط سفلي */}
          <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
            {/* زر علامة الختمة */}
            <TouchableOpacity onPress={saveKhatma} style={styles.bottomBtn}>
              <Ionicons name="flag" size={18} color={colors.textInverse} />
              <Text style={styles.bottomBtnText}>علامة الختمة</Text>
            </TouchableOpacity>

            {/* زر الانتقال */}
            <TouchableOpacity onPress={() => setJumpOpen(true)} style={styles.bottomBtn}>
              <Ionicons name="search" size={18} color={colors.textInverse} />
              <Text style={styles.bottomBtnText}>انتقال</Text>
            </TouchableOpacity>

            {/* زر الورد */}
            <TouchableOpacity onPress={() => setShowWirdModal(true)} style={styles.bottomBtn}>
              <Ionicons name="calendar" size={18} color={colors.textInverse} />
              <Text style={styles.bottomBtnText}>الورد</Text>
            </TouchableOpacity>

            {/* زر التحميل */}
            <TouchableOpacity
              onPress={() => downloaded ? deleteDownload() : setShowDownloadModal(true)}
              style={[styles.bottomBtn, downloaded && styles.bottomBtnGreen]}
            >
              <Ionicons name={downloaded ? 'cloud-done' : 'cloud-download'} size={18} color={colors.textInverse} />
              <Text style={styles.bottomBtnText}>{downloaded ? 'محمّل' : 'تحميل'}</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </>
      )}

      {/* نافذة الانتقال لصفحة */}
      <Modal visible={jumpOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>الانتقال إلى صفحة</Text>
            {khatmaPage > 1 && (
              <TouchableOpacity
                onPress={() => {
                  listRef.current?.scrollToIndex({ index: khatmaPage - 1, animated: false });
                  setPage(khatmaPage);
                  setJumpOpen(false);
                }}
                style={styles.khatmaBtn}
              >
                <Ionicons name="flag" size={16} color={colors.gold} />
                <Text style={styles.khatmaBtnText}>متابعة الختمة (ص {khatmaPage})</Text>
              </TouchableOpacity>
            )}
            <TextInput
              value={jumpVal}
              onChangeText={setJumpVal}
              keyboardType="number-pad"
              placeholder={`1 - ${TOTAL_PAGES}`}
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoFocus
            />
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 10 }}>
              <TouchableOpacity onPress={jumpTo} style={[styles.mBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.textInverse, fontWeight: '800' }}>انتقال</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setJumpOpen(false)} style={[styles.mBtn, { backgroundColor: colors.elevated }]}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* نافذة تأكيد التحميل */}
      <Modal visible={showDownloadModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Ionicons name="cloud-download" size={48} color={colors.primary} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.modalTitle}>تحميل المصحف الكريم</Text>
            <Text style={styles.modalSub}>
              سيتم تحميل 604 صفحة من المصحف الشريف على جهازك (~150MB) لتتمكن من القراءة بدون إنترنت.
            </Text>
            <Text style={styles.modalNote}>تأكد من الاتصال بشبكة Wi-Fi قبل البدء.</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 16 }}>
              <TouchableOpacity onPress={startDownload} style={[styles.mBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.textInverse, fontWeight: '800' }}>بدء التحميل</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDownloadModal(false)} style={[styles.mBtn, { backgroundColor: colors.elevated }]}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>لاحقاً</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* نافذة ضبط الورد اليومي */}
      <Modal visible={showWirdModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>ضبط الورد اليومي</Text>
            {wirdPlan && (
              <View style={styles.currentWird}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.currentWirdText}>الورد الحالي: {wirdPlan.label}</Text>
              </View>
            )}
            <ScrollView showsVerticalScrollIndicator={false}>
              {WIRD_PRESETS.filter(p => p.type !== 'custom').map((preset) => (
                <TouchableOpacity
                  key={preset.type}
                  style={[
                    styles.presetBtn,
                    wirdPlan?.type === preset.type && styles.presetBtnActive,
                  ]}
                  onPress={() => saveWird(preset)}
                >
                  <View>
                    <Text style={[styles.presetTitle, wirdPlan?.type === preset.type && styles.presetTitleActive]}>
                      {preset.label}
                    </Text>
                    <Text style={styles.presetSub}>{preset.pages_per_day} صفحة يومياً</Text>
                  </View>
                  {wirdPlan?.type === preset.type && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}

              {/* خيار مخصص */}
              <View style={styles.customSection}>
                <Text style={styles.customLabel}>عدد صفحات مخصص يومياً:</Text>
                <View style={styles.customRow}>
                  <TextInput
                    value={customPages}
                    onChangeText={setCustomPages}
                    keyboardType="number-pad"
                    placeholder="مثال: 5"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.customInput}
                  />
                  <TouchableOpacity
                    style={styles.customSaveBtn}
                    onPress={() => {
                      const n = parseInt(customPages, 10);
                      if (!n || n < 1 || n > 604) {
                        Alert.alert('خطأ', 'أدخل عدداً صحيحاً بين 1 و 604');
                        return;
                      }
                      saveWird(WIRD_PRESETS[3], n);
                    }}
                  >
                    <Text style={styles.customSaveBtnText}>حفظ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity onPress={() => setShowWirdModal(false)} style={[styles.mBtn, { backgroundColor: colors.elevated, marginTop: 12 }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FBF6E9' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pageWrap: { width, height, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF6E9' },
  pageImg: { width, height, backgroundColor: '#FBF6E9' },

  // شريط علوي
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: 8,
    backgroundColor: 'rgba(20,83,45,0.92)',
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  pagePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full,
  },
  pagePillText: { color: colors.textInverse, fontWeight: '800', fontSize: 13 },

  // شريط الورد
  wirdBar: {
    position: 'absolute', top: 80, left: 0, right: 0,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 8,
    backgroundColor: 'rgba(180,130,0,0.85)',
  },
  wirdBarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  wirdBadge: {
    backgroundColor: colors.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },
  wirdBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // شريط سفلي
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row-reverse', justifyContent: 'space-around', alignItems: 'center',
    paddingBottom: 10, paddingTop: 8,
    backgroundColor: 'rgba(20,83,45,0.92)',
  },
  bottomBtn: {
    alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bottomBtnGreen: { backgroundColor: 'rgba(34,197,94,0.25)' },
  bottomBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: 11 },

  // نوافذ
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modal: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg,
    width: '100%', maxWidth: 420,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'right', marginBottom: 8 },
  modalSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'right', lineHeight: 22, marginBottom: 8 },
  modalNote: { fontSize: 12, color: colors.primary, textAlign: 'right', fontWeight: '700' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    color: colors.textPrimary, textAlign: 'center', marginTop: 8,
  },
  mBtn: { flex: 1, padding: 12, borderRadius: radius.full, alignItems: 'center' },

  // زر الختمة في نافذة الانتقال
  khatmaBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF9E7', borderWidth: 1, borderColor: colors.gold,
    borderRadius: radius.md, padding: 10, marginBottom: 10,
  },
  khatmaBtnText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },

  // خيارات الورد
  presetBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: 10, backgroundColor: colors.elevated,
  },
  presetBtnActive: { borderColor: colors.primary, backgroundColor: '#F0FDF4' },
  presetTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },
  presetTitleActive: { color: colors.primary },
  presetSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },

  customSection: { marginTop: 8, marginBottom: 4 },
  customLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, textAlign: 'right', marginBottom: 8 },
  customRow: { flexDirection: 'row-reverse', gap: 10, alignItems: 'center' },
  customInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    color: colors.textPrimary, textAlign: 'center',
  },
  customSaveBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: radius.full,
  },
  customSaveBtnText: { color: colors.textInverse, fontWeight: '800' },

  currentWird: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: radius.md, padding: 10, marginBottom: 12,
  },
  currentWirdText: { color: colors.success, fontWeight: '700', fontSize: 14 },

  // شاشة التحميل
  dlTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 20, marginBottom: 8 },
  dlSub: { fontSize: 15, color: colors.textSecondary, marginBottom: 20 },
  progressBar: {
    width: '80%', height: 12, backgroundColor: colors.border,
    borderRadius: radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
  dlPct: { fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 10 },
  cancelBtn: {
    marginTop: 30, paddingHorizontal: 30, paddingVertical: 12,
    borderRadius: radius.full, backgroundColor: '#FEE2E2',
  },
  cancelBtnText: { color: '#DC2626', fontWeight: '800', fontSize: 15 },
});
