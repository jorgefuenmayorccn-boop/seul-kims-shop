export default function ProductosLoading() {
  return (
    <div style={{ padding: '48px 64px', background: 'var(--color-baek-pure, #f5f5f2)', minHeight: '80vh' }}>
      <div style={{ height: 14, width: 200, background: 'var(--color-celadon-light, #e8ede9)', marginBottom: 32, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ aspectRatio: '4/5', background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: 10, width: '75%', background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: 10, width: '45%', background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
