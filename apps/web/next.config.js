const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: { removeConsole: process.env.NODE_ENV === "production" },
  experimental: { optimizePackageImports: ["@seul/ui"] },
  transpilePackages: ['@seul/ui', '@seul/tokens', '@seul/icons'],
  // Hallazgo S17 (auditoría final de entrega, 2-sep-2026): `images.remotePatterns` nunca se
  // configuró — next/image rechazaba con 400 (INVALID_IMAGE_OPTIMIZE_REQUEST) CUALQUIER src
  // remoto (protocolo http/https), lo que dejaba TODAS las fotos de producto rotas en el
  // catálogo público (tanto los picsum.photos de placeholder como las fotos reales servidas
  // desde el propio seoulshop.cl/products/*.jpg, porque next/image no reconoce su propio
  // dominio automáticamente cuando el src es una URL absoluta). `products.image_url` en
  // producción solo usa estos 2 hosts (confirmado por SELECT DISTINCT sobre la tabla real).
  //
  // Adición post-entrega (2-sep-2026): `api.seoulshop.cl` agregado porque
  // POST /api/products/:productId/images (packages/api/src/server.ts) ahora
  // puede auto-asignar `products.image_url` apuntando a una foto servida por
  // la propia API (sin R2 configurado, ver GET /product-photos/:filename) —
  // sin este host en la lista, esa portada auto-asignada rompería con el
  // mismo 400 diagnosticado arriba.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'seoulshop.cl' },
      { protocol: 'https', hostname: 'api.seoulshop.cl' },
    ],
  },
};

module.exports = nextConfig;
