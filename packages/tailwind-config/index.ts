import type { Config } from 'tailwindcss'

const config: Omit<Config, 'content'> = {
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // ── Brand ──
        brand: {
          DEFAULT: 'var(--color-brand)',
          hover:   'var(--color-brand-hover)',
          active:  'var(--color-brand-active)',
          subtle:  'var(--color-brand-subtle)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          subtle:  'var(--color-accent-subtle)',
        },

        // ── Surfaces ──
        background: 'var(--color-background)',
        surface:    'var(--color-surface)',
        elevated:   'var(--color-surface-elevated)',

        // ── Text ──
        text: {
          DEFAULT:  'var(--color-text)',
          muted:    'var(--color-text-muted)',
          disabled: 'var(--color-text-disabled)',
          'on-brand': 'var(--color-text-on-brand)',
        },

        // ── Feedback ──
        success: { DEFAULT: 'var(--color-success)', subtle: 'var(--color-success-subtle)' },
        warning: { DEFAULT: 'var(--color-warning)', subtle: 'var(--color-warning-subtle)' },
        error:   { DEFAULT: 'var(--color-error)',   subtle: 'var(--color-error-subtle)' },

        // ── Business: BAES ──
        baes: {
          eligible:     'var(--color-baes-eligible)',
          'not-eligible': 'var(--color-baes-not-eligible)',
          'applied-bg':   'var(--color-baes-applied-bg)',
        },

        // ── Business: Cadena de Frío ──
        cold: {
          frozen:       'var(--color-cold-frozen)',
          refrigerated: 'var(--color-cold-refrigerated)',
          'frozen-bg':       'var(--color-cold-frozen-bg)',
          'refrigerated-bg': 'var(--color-cold-refrigerated-bg)',
        },

        // ── Business: Vencimiento ──
        expiry: {
          fresh:   'var(--color-expiry-fresh)',
          warning: 'var(--color-expiry-warning)',
          urgent:  'var(--color-expiry-urgent)',
          expired: 'var(--color-expiry-expired)',
        },

        // ── Business: DTE ──
        dte: {
          pending: 'var(--color-dte-pending)',
          issued:  'var(--color-dte-issued)',
          failed:  'var(--color-dte-failed)',
        },

        // ── Business: Canales ──
        channel: {
          pos:       'var(--color-channel-pos)',
          web:       'var(--color-channel-web)',
          rappi:     'var(--color-channel-rappi)',
          metro:     'var(--color-channel-metro)',
          b2b:       'var(--color-channel-b2b)',
          whatsapp:  'var(--color-channel-whatsapp)',
        },

        // ── Business: Tiers B2B ──
        tier: {
          hoobae: 'var(--color-tier-hoobae)',
          sunbae: 'var(--color-tier-sunbae)',
          hyung:  'var(--color-tier-hyung)',
        },

        // ── K-wave Design System ──
        kwave: {
          pink:     { 100: 'var(--kwave-pink-100)', 300: 'var(--kwave-pink-300)', 500: 'var(--kwave-pink-500)', 700: 'var(--kwave-pink-700)' },
          gold:     { 100: 'var(--kwave-gold-100)', 300: 'var(--kwave-gold-300)', 500: 'var(--kwave-gold-500)', 700: 'var(--kwave-gold-700)' },
          lavender: { 100: 'var(--kwave-lavender-100)', 300: 'var(--kwave-lavender-300)', 500: 'var(--kwave-lavender-500)' },
          mint:     { 100: 'var(--kwave-mint-100)', 500: 'var(--kwave-mint-500)' },
          navy:     { 800: 'var(--kwave-navy-800)', 900: 'var(--kwave-navy-900)' },
        },

        // ── Business: Comandas ──
        comanda: {
          nueva:      'var(--color-comanda-nueva)',
          preparando: 'var(--color-comanda-preparando)',
          lista:      'var(--color-comanda-lista)',
          entregada:  'var(--color-comanda-entregada)',
          cancelada:  'var(--color-comanda-cancelada)',
        },

        // ── Obangsaek — Sistema editorial coreano ──
        celadon: {
          DEFAULT: 'var(--color-celadon)',
          light:   'var(--color-celadon-light)',
          dark:    'var(--color-celadon-dark)',
          100: 'var(--celadon-100)',
          300: 'var(--celadon-300)',
          500: 'var(--celadon-500)',
          700: 'var(--celadon-700)',
          900: 'var(--celadon-900)',
        },
        baek: {
          DEFAULT: 'var(--color-baek)',
          pure:    'var(--color-baek-pure)',
          50:  'var(--baek-50)',
          100: 'var(--baek-100)',
        },
        heuk: {
          DEFAULT: 'var(--color-heuk)',
          soft:    'var(--color-heuk-soft)',
          800: 'var(--heuk-800)',
          900: 'var(--heuk-900)',
          950: 'var(--heuk-950)',
        },
        seoul: {
          red:  'var(--color-seoul-red)',
        },
      },

      fontFamily: {
        headline: ['var(--font-headline)'],
        body:     ['var(--font-body)'],
        mono:     ['var(--font-mono)'],
        korean:   ['var(--font-korean)'],
        display:  ['var(--font-display)'],
      },

      borderRadius: {
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        full: 'var(--radius-full)',
      },

      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
        '16': 'var(--space-16)',
        '20': 'var(--space-20)',
        // POS-specific
        'pos-hit': 'var(--pos-hit-area-min)',
        'pos-category': 'var(--pos-category-width)',
      },

      boxShadow: {
        sm:         'var(--shadow-sm)',
        md:         'var(--shadow-md)',
        lg:         'var(--shadow-lg)',
        pos:        'var(--shadow-pos)',
        'kwave':    'var(--shadow-kwave-card)',
        'brand-glow': 'var(--shadow-brand-glow)',
        'pink-glow':  'var(--shadow-pink-glow)',
      },

      transitionDuration: {
        fast:   'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow:   'var(--duration-slow)',
      },

      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
      },

      minHeight: {
        'pos-hit': 'var(--pos-hit-area-min)',
      },
    },
  },
}

export default config
