import type { Config } from 'tailwindcss';

// 글로벌쇼츠 스튜디오 Tailwind 프리셋 (모바일 ~767 / 태블릿 768~1199 / 데스크탑 1200~)
const preset: Partial<Config> = {
  theme: {
    screens: { md: '768px', xl: '1200px' },
    extend: {
      colors: {
        bg: '#0B0B0D', panel: '#141518', card: '#1C1D21', card2: '#232429', line: '#2A2B31',
        sub: '#A1A1AA', accent: '#FFD83D', pink: '#FF5C9E', ok: '#22C55E', danger: '#E5484D',
      },
      backgroundImage: { cta: 'linear-gradient(90deg,#FFD24D,#FF5C9E)' },
      fontFamily: { sans: ["'Noto Sans KR'", 'system-ui', 'sans-serif'] },
      fontSize: {
        body: ['13px', '1.55'], 'body-md': ['14px', '1.55'],
        h1: ['18px', '1.3'], 'h1-md': ['22px', '1.3'], 'h1-xl': ['26px', '1.3'],
        h2: ['15px', '1.4'], 'h2-md': ['17px', '1.4'],
      },
    },
  },
};
export default preset;
