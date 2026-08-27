export default function Home() {
  return (
    <html>
      <head>
        <title>SEUL KIMS - Productos Coreanos</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: 'system-ui, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 'bold', margin: '0 0 20px 0' }}>
            🛍️ SEUL KIMS
          </h1>
          <p style={{ fontSize: '24px', margin: '0 0 40px 0', opacity: 0.9 }}>
            Productos Coreanos • Viña del Mar
          </p>
          <p style={{ fontSize: '14px', opacity: 0.7 }}>
            ✅ Sitio en línea
          </p>
        </div>
      </body>
    </html>
  );
}
