export const colors = {
  bg: '#FAFAF9',
  card: '#FFFFFF',
  elevated: '#F5F5F4',
  sand: '#E7E5E4',
  primary: '#14532D',
  primaryLight: '#166534',
  primaryDark: '#0B3C1E',
  gold: '#D97706',
  goldLight: '#F59E0B',
  goldBg: '#FEF3C7',
  textPrimary: '#1C1917',
  textSecondary: '#57534E',
  textTertiary: '#A8A29E',
  textInverse: '#FFFFFF',
  textInverseMuted: 'rgba(255,255,255,0.85)',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  border: '#E7E5E4',
  overlay: 'rgba(20,83,45,0.85)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
};

export const PRAYERS_AR: Record<string, string> = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
};

export const PRAYER_ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = typeof PRAYER_ORDER[number];
