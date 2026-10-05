export const palettes = {
  light: {
    primary: '#245cbd',
    onPrimary: '#ffffff',
    primaryContainer: '#e9f0ff',
    background: '#f6f8fc',
    surface: '#ffffff',
    surfaceVariant: '#edf1f7',
    border: '#dce3ed',
    textPrimary: '#17283f',
    textSecondary: '#55647a',
    success: '#12685f',
    warning: '#805600',
    error: '#ad2525',
  },
  dark: {
    primary: '#a7c5ff',
    onPrimary: '#10294d',
    primaryContainer: '#243c60',
    background: '#101925',
    surface: '#182535',
    surfaceVariant: '#243244',
    border: '#354356',
    textPrimary: '#eef3fc',
    textSecondary: '#b2bed0',
    success: '#8ed6c4',
    warning: '#f5c766',
    error: '#ffaaaa',
  },
} as const;

export type ThemeColors = { readonly [Key in keyof typeof palettes.light]: string };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const typeScale = {
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  caption: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
} as const;
export const radii = { sm: 8, md: 12 } as const;
export const touchTarget = 44;
