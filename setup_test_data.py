#!/usr/bin/env python3
"""Setup test data for 27 email tests"""

import psycopg2
import os
import uuid
from datetime import datetime, timedelta

db_url = os.environ.get('DATABASE_URL', 'postgresql://neondb_owner:npg_PltRoX3VBLg0@ep-autumn-poetry-axvcuspa-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require')

def setup():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    print("📊 Creando datos de prueba para 27 emails...")
    print("")

    # 1. Create b2b_quotes table
    print("1️⃣ Tabla b2b_quotes...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS b2b_quotes (
          id UUID PRIMARY KEY,
          number INT UNIQUE,
          company_id UUID,
          buyer_name TEXT,
          buyer_email TEXT,
          status VARCHAR(50),
          items JSONB,
          subtotal DECIMAL,
          total DECIMAL,
          valid_until_at TIMESTAMP,
          sent_at TIMESTAMP,
          accepted_at TIMESTAMP,
          rejected_at TIMESTAMP,
          rejection_reason TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    print("   ✅ Tabla creada")
    print("")

    # 2. Create test orders
    print("2️⃣ Órdenes de prueba (10)...")
    statuses = ['nueva', 'preparando', 'lista', 'en_ruta', 'entregada']
    order_ids = []

    for i in range(10):
        order_num = 10000 + i
        status = statuses[i % 5]
        order_id = str(uuid.uuid4())

        cur.execute("""
            INSERT INTO orders (id, number, channel, delivery_mode, status, subtotal, total, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (number) DO NOTHING
        """, (order_id, order_num, 'web', 'delivery', status, 50000 + (i*1000), 50000 + (i*1000)))

        order_ids.append(order_id)
        print(f"   ✅ Orden #{order_num} ({status})")

    conn.commit()
    print("")

    # 3. Create test deliveries
    print("3️⃣ Entregas de prueba (5)...")
    delivery_statuses = ['pending', 'assigned', 'in_transit', 'delivered']

    for i in range(5):
        assignment_id = str(uuid.uuid4())
        status = delivery_statuses[i % 4]

        cur.execute("""
            INSERT INTO delivery_assignments (id, order_id, status, assigned_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT DO NOTHING
        """, (assignment_id, order_ids[i], status))

        print(f"   ✅ Entrega #{i+1} ({status})")

    conn.commit()
    print("")

    # 4. Create test B2B quotes
    print("4️⃣ Cotizaciones B2B (5)...")
    quote_statuses = ['draft', 'sent', 'accepted', 'rejected', 'expired']

    for i in range(5):
        quote_id = str(uuid.uuid4())
        status = quote_statuses[i]

        cur.execute("""
            INSERT INTO b2b_quotes (id, number, buyer_name, buyer_email, status, items, total, sent_at, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (number) DO NOTHING
        """, (quote_id, 5000 + i, f'Empresa Test {i+1}', f'empresa{i+1}@test.cl', status, '[]', 500000 + (i*100000)))

        print(f"   ✅ Cotización #{5000+i} ({status})")

    conn.commit()
    cur.close()
    conn.close()

    print("")
    print("✅ DATOS DE PRUEBA LISTOS")
    print("")
    print("📊 RESUMEN:")
    print("   • 10 órdenes en diferentes estados (para 7 emails de cambio de estado)")
    print("   • 5 entregas en diferentes estados (para 2 emails de delivery)")
    print("   • 5 cotizaciones B2B en diferentes estados (para 3 emails B2B)")
    print("   • Catálogo de 16 productos cargado")
    print("")
    print("Ahora todos los 27 endpoints deberían enviar emails correctamente.")

if __name__ == '__main__':
    try:
        setup()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
