export default function ShopLoading() {
  return (
    <div style={{ minHeight: '60vh', background: 'var(--color-baek-pure, #f5f5f2)' }}>
      <div style={{ height: 480, background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ padding: '48px 64px' }}>
        <div style={{ height: 12, width: 120, background: 'var(--color-celadon-light, #e8ede9)', marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ aspectRatio: '4/5', background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: 10, width: '70%', background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: 10, width: '40%', background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
