import postgres from 'postgres';

async function seedTestData() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    // 1. Insert test customer
    const customer = await sql`
      INSERT INTO customers (name, email, rut, document_type, document_number, created_channel)
      VALUES (${'Test B2B Company'}, ${'b2b.test@seoulshop.cl'}, ${'12.345.678-K'}, ${'rut'}, ${'12345678K'}, ${'b2b'})
      ON CONFLICT (email) DO UPDATE SET email = 'b2b.test@seoulshop.cl'
      RETURNING id, email
    `;

    const customerId = customer[0]?.id;
    console.log('✓ Customer created:', customerId);

    // 2. Insert b2b_company
    const company = await sql`
      INSERT INTO b2b_companies (customer_id, razon_social, rut, giro, tier, status)
      VALUES (${customerId}, ${'Test B2B Company SpA'}, ${'12.345.678-K'}, ${'Distribución'}, ${'hoobae'}, ${'approved'})
      ON CONFLICT (rut) DO UPDATE SET razon_social = 'Test B2B Company SpA'
      RETURNING id, razon_social
    `;

    const companyId = company[0]?.id;
    console.log('✓ B2B Company created:', companyId);

    // 3. Verify delivery_assignments exists
    const delivery = await sql`SELECT COUNT(*) as cnt FROM delivery_assignments`;
    console.log('✓ Delivery assignments count:', delivery[0]?.cnt || 0);

    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error('Error:', (err as any).message);
    process.exit(1);
  }
}

seedTestData();
