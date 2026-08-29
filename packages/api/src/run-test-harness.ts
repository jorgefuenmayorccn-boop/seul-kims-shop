// ============================================================================
// RUNNER — SESSION 20 test harness
// ============================================================================
// Herramienta QA INTERNA de VÉRTICE. Ejecuta sendAllTestEmails() y hace polling
// real contra email_queue en Neon hasta que cada email quede 'sent' o 'failed'
// (o timeout tras 20 intentos x 1s). Imprime tabla Markdown final.
//
// Uso: TEST_EMAIL=... API_BASE_URL=... npx tsx --env-file=.dev.vars src/run-test-harness.ts
// ============================================================================

import { sendAllTestEmails } from './test-harness'
import { sql } from './db'

interface FinalResult {
  email: number
  category: string
  description: string
  real: boolean
  queue_id?: string
  finalStatus: 'sent' | 'failed' | 'timeout' | 'no-queue-id'
  lastError?: string | null
}

async function main() {
  const emailTo = process.env.TEST_EMAIL || 'jsfuenmayorproduction@gmail.com'
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000'

  console.log(`🧪 Disparando 27 emails de prueba → ${emailTo} (API: ${apiBaseUrl})\n`)
  const results = await sendAllTestEmails(emailTo, apiBaseUrl)

  const final: FinalResult[] = []

  for (const r of results) {
    if (r.status === 'error' || !r.queue_id) {
      final.push({ ...r, finalStatus: 'no-queue-id', lastError: r.error })
      continue
    }

    let lastRow: { status: string; last_error: string | null } | undefined
    for (let attempt = 0; attempt < 20; attempt++) {
      const [row] = await sql`SELECT status, last_error FROM email_queue WHERE id = ${r.queue_id}`
      lastRow = row as any
      if (lastRow?.status === 'sent' || lastRow?.status === 'failed') break
      await new Promise((res) => setTimeout(res, 1000))
    }

    final.push({
      ...r,
      finalStatus: (lastRow?.status === 'sent' || lastRow?.status === 'failed') ? lastRow.status as 'sent' | 'failed' : 'timeout',
      lastError: lastRow?.last_error ?? null,
    })
  }

  console.log('\n| # | Categoría | Descripción | Tipo | Estado |')
  console.log('|---|---|---|---|---|')
  for (const f of final) {
    const icon = f.finalStatus === 'sent' ? '✅' : '❌'
    const tipo = f.real ? 'Real' : 'Simulado'
    console.log(`| ${f.email} | ${f.category} | ${f.description} | ${tipo} | ${icon} ${f.finalStatus}${f.lastError ? ` (${f.lastError})` : ''} |`)
  }

  const sentCount = final.filter((f) => f.finalStatus === 'sent').length
  console.log(`\n${sentCount}/27 confirmados como 'sent' en email_queue (Neon)`)

  await sql.end()
  process.exitCode = sentCount === 27 ? 0 : 1
}

main().catch((e) => {
  console.error('❌ Error fatal en run-test-harness:', e)
  process.exit(1)
})
