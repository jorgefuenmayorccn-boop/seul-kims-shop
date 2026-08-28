export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'seul-tienda',
    version: '1.0.0',
    uptime: process.uptime(),
  })
}
