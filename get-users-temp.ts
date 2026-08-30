import postgres from 'postgres'

const sql = postgres('postgresql://neondb_owner:npg_PltRoX3VBLg0@ep-autumn-poetry-axvcuspa-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require', { ssl: 'require' })

async function main() {
  const users = await sql`SELECT email, role, name FROM users ORDER BY role`
  console.log('\n✅ USUARIOS EN LA BASE DE DATOS:\n')
  users.forEach(u => {
    console.log(`📧 ${u.email}`)
    console.log(`   Role: ${u.role}`)
    console.log(`   Nombre: ${u.name}\n`)
  })
  await sql.end()
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})
