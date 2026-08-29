#!/usr/bin/env python3
"""
Seoul Shop Catalog Loader - Fixed
Carga productos con precios: Compra, B2B, B2C
"""

import psycopg2
import os
import uuid
from slugify import slugify  # pip install python-slugify

db_url = os.environ.get('DATABASE_URL', 'postgresql://neondb_owner:npg_PltRoX3VBLg0@ep-autumn-poetry-axvcuspa-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require')

# Categorías
CATEGORIES = [
    {"name": "🌶️ Conservas", "emoji": "🌶️"},
    {"name": "🥘 Salsas", "emoji": "🥘"},
    {"name": "🍚 Arroces", "emoji": "🍚"},
    {"name": "🌾 Granos", "emoji": "🌾"},
    {"name": "🍜 Fideos", "emoji": "🍜"},
    {"name": "🥤 Bebidas", "emoji": "🥤"},
    {"name": "🍿 Snacks", "emoji": "🍿"},
    {"name": "🧂 Condimentos", "emoji": "🧂"},
    {"name": "❄️ Congelados", "emoji": "❄️"},
    {"name": "🧀 Lácteos", "emoji": "🧀"},
]

# PRODUCTOS - Precios B2B base
PRODUCTS = [
    # Kimchi
    {"name": "Kimchi Tradicional 500g", "sku": "KIM001", "category": "🌶️ Conservas", "b2b_price": 8000},
    {"name": "Kimchi Picante Extra 500g", "sku": "KIM002", "category": "🌶️ Conservas", "b2b_price": 9500},
    {"name": "Kimchi Sin Ajo 500g", "sku": "KIM003", "category": "🌶️ Conservas", "b2b_price": 8500},
    # Salsas
    {"name": "Gochujang (Pasta Roja) 500g", "sku": "SAL001", "category": "🥘 Salsas", "b2b_price": 7000},
    {"name": "Doenjang (Pasta Soja) 500g", "sku": "SAL002", "category": "🥘 Salsas", "b2b_price": 6500},
    {"name": "Gochujang Suave 500g", "sku": "SAL003", "category": "🥘 Salsas", "b2b_price": 7500},
    # Arroz
    {"name": "Arroz Coreano Corto 5kg", "sku": "ARR001", "category": "🍚 Arroces", "b2b_price": 18000},
    {"name": "Arroz Glutinoso 5kg", "sku": "ARR002", "category": "🍚 Arroces", "b2b_price": 20000},
    # Fideos
    {"name": "Ramyeon Rojo Picante 5pzas", "sku": "FID001", "category": "🍜 Fideos", "b2b_price": 4500},
    {"name": "Ramyeon Seafood 5pzas", "sku": "FID002", "category": "🍜 Fideos", "b2b_price": 5500},
    # Bebidas
    {"name": "Bebida de Maíz 250ml", "sku": "BEB001", "category": "🥤 Bebidas", "b2b_price": 2500},
    {"name": "Sujeonggwa 1L", "sku": "BEB003", "category": "🥤 Bebidas", "b2b_price": 5500},
    # Snacks
    {"name": "Seaweed Snack 10g", "sku": "SNK001", "category": "🍿 Snacks", "b2b_price": 1500},
    {"name": "Tteokbokki Mix 500g", "sku": "SNK002", "category": "🍿 Snacks", "b2b_price": 4000},
    # Condimentos
    {"name": "Sesame Seeds 200g", "sku": "CON001", "category": "🧂 Condimentos", "b2b_price": 4500},
    {"name": "Sal Marina Coreana 500g", "sku": "CON003", "category": "🧂 Condimentos", "b2b_price": 3000},
]

def calculate_prices(b2b):
    """
    B2B = precio mayorista (base)
    B2C = B2B + 25%
    Compra = B2B × 50% (costo)
    """
    return {
        'b2b': b2b,
        'b2c': int(b2b * 1.25),
        'compra': int(b2b * 0.5)
    }

def load():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    print("🚀 Cargando Catálogo Seoul Shop...")
    print("")

    # 1. Insert categories
    print("📂 Creando categorías...")
    cat_map = {}
    for cat in CATEGORIES:
        cur.execute("""
            INSERT INTO categories (id, name, slug, emoji, sort_order)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE SET emoji = %s
            RETURNING id
        """, (str(uuid.uuid4()), cat['name'], cat['name'].lower().replace(' ', '-'), cat['emoji'], 0, cat['emoji']))
        cat_id = cur.fetchone()[0]
        cat_map[cat['name']] = cat_id

    conn.commit()

    # 2. Insert products
    print("📦 Cargando productos...")
    inserted = 0
    for prod in PRODUCTS:
        prices = calculate_prices(prod['b2b_price'])
        cat_id = cat_map[prod['category']]

        cur.execute("""
            INSERT INTO products (id, sku, name, slug, description, category_id, cost_price, price_b2b, price_web, price_retail, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
            ON CONFLICT (sku) DO UPDATE SET
                name = %s, category_id = %s, cost_price = %s, price_b2b = %s, price_web = %s
        """, (
            str(uuid.uuid4()), prod['sku'], prod['name'],
            prod['name'].lower().replace(' ', '-'),
            f"Producto importado de Corea. Categoría: {prod['category']}",
            cat_id, prices['compra'], prices['b2b'], prices['b2c'], prices['b2c'],
            # UPDATE
            prod['name'], cat_id, prices['compra'], prices['b2b'], prices['b2c']
        ))

        inserted += 1
        print(f"  ✅ {prod['sku']:10} | {prod['name']:40} | B2B: ${prices['b2b']:8,} | B2C: ${prices['b2c']:8,} | Compra: ${prices['compra']:8,}")

    conn.commit()
    cur.close()
    conn.close()

    print("")
    print(f"✅ CATÁLOGO CARGADO: {inserted} productos + {len(CATEGORIES)} categorías")
    print("")
    print("📊 ESTRUCTURA DE PRECIOS:")
    print("   Precio de Compra = B2B × 50%  (costo interno)")
    print("   Precio B2B       = Base       (mayorista)")
    print("   Precio B2C       = B2B × 125% (público/web)")
    print("")
    print("✨ Catálogo completo: Catálogo Seoul Shop Nuevo_260829_060915")

if __name__ == '__main__':
    try:
        load()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
