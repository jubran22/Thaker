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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, shadow } from '../constants/theme';
import { getDeviceId, apiGet, apiPost } from '../utils/api';

const { width, height } = Dimensions.get('window');
const TOTAL_PAGES = 604;
const pageUrl = (p: number) =>
  `https://raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/${String(p).padStart(3, '0')}.png`;

export default function QuranScreen() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpVal, setJumpVal] = useState('');
  const [chromeVisible, setChromeVisible] = useState(true);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const id = await getDeviceId();
    setDeviceId(id);
    try {
      const bm = await apiGet<any>(`/quran/bookmark?device_id=${id}`);
      const p = Math.max(1, Math.min(TOTAL_PAGES, Number(bm?.page) || 1));
      setPage(p);
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: p - 1, animated: false });
      }, 50);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveBookmark = async (p: number) => {
    try {
      await apiPost('/quran/bookmark', { device_id: deviceId, page: p });
      Alert.alert('تم الحفظ', `تم حفظ علامة عند الصفحة ${p}`);
    } catch {
      Alert.alert('خطأ', 'تعذر حفظ العلامة');
    }
  };

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

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
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
        inverted // RTL: swipe right goes to next page in Arabic reading
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
              source={{ uri: pageUrl(item) }}
              style={styles.pageImg}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
      />

      {chromeVisible && (
        <>
          <SafeAreaView edges={['top']} style={styles.topBar}>
            <TouchableOpacity
              testID="quran-back"
              onPress={() => router.back()}
              style={styles.iconBtn}
            >
              <Ionicons name="close" size={26} color={colors.textInverse} />
            </TouchableOpacity>
            <View style={styles.pagePill}>
              <Text style={styles.pagePillText}>صفحة {page} / {TOTAL_PAGES}</Text>
            </View>
            <TouchableOpacity
              testID="quran-bookmark"
              onPress={() => saveBookmark(page)}
              style={styles.iconBtn}
            >
              <Ionicons name="bookmark" size={22} color={colors.gold} />
            </TouchableOpacity>
          </SafeAreaView>

          <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
            <TouchableOpacity
              testID="quran-jump"
              onPress={() => setJumpOpen(true)}
              style={styles.bottomBtn}
            >
              <Ionicons name="search" size={18} color={colors.textInverse} />
              <Text style={styles.bottomBtnText}>انتقال لصفحة</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </>
      )}

      <Modal visible={jumpOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>الانتقال إلى صفحة</Text>
            <TextInput
              testID="quran-jump-input"
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FBF6E9' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pageWrap: {
    width,
    height,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF6E9',
  },
  pageImg: { width: width, height: height, backgroundColor: '#FBF6E9' },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
    backgroundColor: 'rgba(20,83,45,0.9)',
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
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingBottom: 10,
  },
  bottomBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: radius.full, ...shadow.md,
  },
  bottomBtnText: { color: colors.textInverse, fontWeight: '800' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modal: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'right', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    color: colors.textPrimary, textAlign: 'center',
  },
  mBtn: { flex: 1, padding: 12, borderRadius: radius.full, alignItems: 'center' },
});
