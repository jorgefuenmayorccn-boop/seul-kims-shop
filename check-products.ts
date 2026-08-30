import postgres from 'postgres'

const sql = postgres('postgresql://neondb_owner:npg_PltRoX3VBLg0@ep-autumn-poetry-axvcuspa-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require', { ssl: 'require' })

async function main() {
  const result = await sql`SELECT COUNT(*) as count FROM products WHERE status = 'active'`
  console.log(`\n📦 Productos activos: ${result[0].count}`)
  
  if (result[0].count === 0) {
    console.log('\n⚠️ La tienda está vacía — sin productos cargados')
    console.log('Necesitas cargar productos antes de que la tienda sea funcional')
  } else {
    console.log(`✅ Tienda debería mostrar ${result[0].count} productos`)
  }
  
  await sql.end()
}

main()
