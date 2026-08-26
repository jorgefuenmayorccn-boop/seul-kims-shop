export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, sans-serif',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '20px' }}>
        🛍️ SEUL KIMS
      </h1>
      <p style={{ fontSize: '24px', marginBottom: '40px', opacity: 0.9 }}>
        Productos Coreanos • Viña del Mar
      </p>
      <div style={{
        display: 'flex',
        gap: '20px',
        fontSize: '16px'
      }}>
        <a href="https://wa.me/56912345678" style={{
          padding: '12px 24px',
          background: '#25D366',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '8px',
          fontWeight: 'bold'
        }}>
          WhatsApp
        </a>
        <a href="https://instagram.com/seulkims" style={{
          padding: '12px 24px',
          background: '#E4405F',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '8px',
          fontWeight: 'bold'
        }}>
          Instagram
        </a>
      </div>
      <p style={{ marginTop: '60px', opacity: 0.7, fontSize: '14px' }}>
        Próximamente: Tienda en línea completa
      </p>
    </div>
  );
}
