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

        // ── Business: Comandas ──
        comanda: {
          nueva:      'var(--color-comanda-nueva)',
          preparando: 'var(--color-comanda-preparando)',
          lista:      'var(--color-comanda-lista)',
          entregada:  'var(--color-comanda-entregada)',
          cancelada:  'var(--color-comanda-cancelada)',
        },
      },

      fontFamily: {
        headline: ['var(--font-headline)'],
        body:     ['var(--font-body)'],
        mono:     ['var(--font-mono)'],
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
        sm:  'var(--shadow-sm)',
        md:  'var(--shadow-md)',
        lg:  'var(--shadow-lg)',
        pos: 'var(--shadow-pos)',
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
