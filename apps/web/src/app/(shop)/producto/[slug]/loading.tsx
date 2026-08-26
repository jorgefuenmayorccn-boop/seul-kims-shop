export default function ProductoLoading() {
  return (
    <div style={{ padding: '48px 64px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, maxWidth: 1100, margin: '0 auto', background: 'var(--color-baek-pure, #f5f5f2)', minHeight: '80vh' }}>
      <div style={{ aspectRatio: '1', background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 24 }}>
        <div style={{ height: 10, width: '40%', background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 28, width: '80%', background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 18, width: '30%', background: 'var(--color-celadon-light, #e8ede9)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 44, width: '100%', background: 'var(--color-celadon-light, #e8ede9)', marginTop: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  )
}
