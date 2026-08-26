// Mata procesos en los puertos del sistema antes de arrancar
import { execSync } from 'node:child_process'
const ports = [3000, 3001, 3002, 3003, 8787]
for (const port of ports) {
  try { execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' }) } catch {}
}
console.log('Puertos liberados. Iniciando sistema...')
