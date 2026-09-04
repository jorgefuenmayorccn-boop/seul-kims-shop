// Seoul Shop — Print Agent v1.0
// Escucha en 127.0.0.1:9101 — envía tickets ESC/POS a impresora térmica
// Compatible: Epson TM-T20, TM-T82, TM-T88, Bixolon SRP-350, Star TSP143

const http    = require('http')
const fs      = require('fs')
const path    = require('path')
const printer = require('./printer')

const CONFIG_PATH = path.join(__dirname, 'config.json')
let config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))

const PORT = config.port || 9101
const HOST = '127.0.0.1'  // solo loopback — nunca exponer a la red

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  'http://localhost:3001')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function json(res, status, body) {
  cors(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end',  () => {
      try { resolve(JSON.parse(data)) }
      catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    cors(res)
    res.writeHead(204)
    res.end()
    return
  }

  // GET /health
  if (req.method === 'GET' && req.url === '/health') {
    const status = await printer.getStatus(config)
    return json(res, status.ready ? 200 : 503, {
      ok:      status.ready,
      printer: status.name,
      version: '1.0.0',
      config:  { interface: config.interface, type: config.printerType },
    })
  }

  // POST /print — recibe TicketPayload JSON
  if (req.method === 'POST' && req.url === '/print') {
    let payload
    try {
      payload = await readBody(req)
    } catch {
      return json(res, 400, { ok: false, error: 'Invalid JSON payload' })
    }

    try {
      await printer.printTicket(payload, config)
      return json(res, 200, { ok: true, mode: 'agent' })
    } catch (err) {
      console.error('[PRINT_ERROR]', err.message)
      return json(res, 503, { ok: false, error: err.message, mode: 'agent' })
    }
  }

  // POST /open-drawer
  if (req.method === 'POST' && req.url === '/open-drawer') {
    try {
      await printer.openDrawer(config)
      return json(res, 200, { ok: true })
    } catch (err) {
      return json(res, 503, { ok: false, error: err.message })
    }
  }

  // POST /config
  if (req.method === 'POST' && req.url === '/config') {
    let newConfig
    try {
      newConfig = await readBody(req)
    } catch {
      return json(res, 400, { ok: false, error: 'Invalid JSON' })
    }
    config = { ...config, ...newConfig }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
    return json(res, 200, { ok: true, config })
  }

  // GET /config
  if (req.method === 'GET' && req.url === '/config') {
    return json(res, 200, config)
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, HOST, () => {
  console.log(`\n Seoul Shop Print Agent v1.0`)
  console.log(` Escuchando en http://${HOST}:${PORT}`)
  console.log(` Impresora: ${config.printerType} via ${config.interface}`)
  console.log(` CORS: http://localhost:3001\n`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Puerto ${PORT} en uso. ¿Hay otra instancia del agente corriendo?`)
    process.exit(1)
  }
  throw err
})
