#!/usr/bin/env python3
"""
Seoul Shop Catalog Loader
Cargaproductos con precios B2B, B2C y Compra
"""

import psycopg2
import os
from datetime import datetime

# Database connection
db_url = os.environ.get('DATABASE_URL', 'postgresql://neondb_owner:npg_PltRoX3VBLg0@ep-autumn-poetry-axvcuspa-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require')

# PRODUCTOS COREANOS - Precios en CLP (B2B)
PRODUCTS = [
    # Kimchi
    {"sku": "KIM001", "name": "Kimchi Tradicional 500g", "category": "Conservas", "b2b_price": 8000, "description": "Kimchi clásico coreano tradicional"},
    {"sku": "KIM002", "name": "Kimchi Picante Extra 500g", "category": "Conservas", "b2b_price": 9500, "description": "Kimchi con extra picante"},
    {"sku": "KIM003", "name": "Kimchi Sin Ajo 500g", "category": "Conservas", "b2b_price": 8500, "description": "Kimchi sin ajo para alergias"},

    # Salsas
    {"sku": "SAL001", "name": "Gochujang (Pasta Roja) 500g", "category": "Salsas", "b2b_price": 7000, "description": "Pasta de chile rojo fermentada"},
    {"sku": "SAL002", "name": "Doenjang (Pasta Soja) 500g", "category": "Salsas", "b2b_price": 6500, "description": "Pasta de soja fermentada"},
    {"sku": "SAL003", "name": "Gochujang Suave 500g", "category": "Salsas", "b2b_price": 7500, "description": "Gochujang menos picante"},

    # Arroz y Granos
    {"sku": "ARR001", "name": "Arroz Coreano Corto 5kg", "category": "Arroces", "b2b_price": 18000, "description": "Arroz coreano de grano corto"},
    {"sku": "ARR002", "name": "Arroz Glutinoso 5kg", "category": "Arroces", "b2b_price": 20000, "description": "Arroz glutinoso para postres"},
    {"sku": "GRA001", "name": "Avena Coreana 1kg", "category": "Granos", "b2b_price": 5500, "description": "Avena de calidad coreana"},

    # Fideos y Pasta
    {"sku": "FID001", "name": "Ramyeon Rojo Picante 5pzas", "category": "Fideos", "b2b_price": 4500, "description": "Fideos instantáneos ramyeon"},
    {"sku": "FID002", "name": "Ramyeon Seafood 5pzas", "category": "Fideos", "b2b_price": 5500, "description": "Ramyeon con sabor a mariscos"},
    {"sku": "FID003", "name": "Fideos Jjajangmyeon 4pzas", "category": "Fideos", "b2b_price": 6000, "description": "Fideos negros fermentados"},

    # Bebidas
    {"sku": "BEB001", "name": "Bebida de Maíz 250ml", "category": "Bebidas", "b2b_price": 2500, "description": "Bebida refrescante de maíz"},
    {"sku": "BEB002", "name": "Bebida de Jengibre 250ml", "category": "Bebidas", "b2b_price": 3000, "description": "Jengibre fresco en botella"},
    {"sku": "BEB003", "name": "Sujeonggwa (Bebida Tradicional) 1L", "category": "Bebidas", "b2b_price": 5500, "description": "Bebida tradicional coreana de especias"},

    # Snacks
    {"sku": "SNK001", "name": "Seaweed Snack (Alga) 10g", "category": "Snacks", "b2b_price": 1500, "description": "Alga tostada con sal"},
    {"sku": "SNK002", "name": "Tteokbokki Mix 500g", "category": "Snacks", "b2b_price": 4000, "description": "Mezcla para tteokbokki (pasteles de arroz)"},
    {"sku": "SNK003", "name": "Hotteok Mix 300g", "category": "Snacks", "b2b_price": 3500, "description": "Mezcla para hotteok dulce"},

    # Condimentos
    {"sku": "CON001", "name": "Sesame Seeds 200g", "category": "Condimentos", "b2b_price": 4500, "description": "Semillas de sésamo tostadas"},
    {"sku": "CON002", "name": "Wasabi en Polvo 50g", "category": "Condimentos", "b2b_price": 5000, "description": "Wasabi en polvo puro"},
    {"sku": "CON003", "name": "Sal Marina Coreana 500g", "category": "Condimentos", "b2b_price": 3000, "description": "Sal marina premium"},

    # Alimentos Congelados
    {"sku": "CON001", "name": "Gyoza Coreana 500g", "category": "Congelados", "b2b_price": 6500, "description": "Dumplings coreanos precocidos"},
    {"sku": "MOZ001", "name": "Mozzarella Coreana Ralada 500g", "category": "Lácteos", "b2b_price": 7000, "description": "Queso mozzarella rallado"},
]

def calculate_prices(b2b_price):
    """Calcula precios B2C (B2B + 25%) y Compra (B2B - 50%)"""
    b2c_price = int(b2b_price * 1.25)  # +25% para B2C
    compra_price = int(b2b_price * 0.5)  # -50% = 50% del B2B
    return {
        'b2b': b2b_price,
        'b2c': b2c_price,
        'compra': compra_price
    }

def load_catalog():
    """Carga el catálogo en la BD"""
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        print("🚀 Cargando catálogo Seoul Shop...")
        print("")

        inserted = 0
        for product in PRODUCTS:
            prices = calculate_prices(product['b2b_price'])

            # Insert or update product
            cur.execute("""
                INSERT INTO products (name, sku, category, description, price, cost_price, is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, true, NOW())
                ON CONFLICT (sku) DO UPDATE SET
                    name = %s,
                    category = %s,
                    description = %s,
                    price = %s,
                    cost_price = %s
            """, (
                product['name'], product['sku'], product['category'], product['description'],
                prices['b2c'], prices['compra'],  # INSERT values
                product['name'], product['category'], product['description'],
                prices['b2c'], prices['compra']   # UPDATE values
            ))

            inserted += 1
            print(f"✅ {product['sku']} | {product['name']}")
            print(f"   B2B: ${product['b2b_price']:,} | B2C: ${prices['b2c']:,} | Compra: ${prices['compra']:,}")

        conn.commit()
        cur.close()
        conn.close()

        print("")
        print(f"✅ CATÁLOGO CARGADO: {inserted} productos")
        print("")
        print("📊 Precios:")
        print("   - Precio Compra: B2B × 50% (costo interno)")
        print("   - Precio B2B: Mayorista (base)")
        print("   - Precio B2C: B2B × 125% (público)")

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    return True

if __name__ == '__main__':
    load_catalog()
