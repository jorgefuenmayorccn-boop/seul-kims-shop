import type { Locale } from '@/lib/locale-store'

type Dict = {
  nav: {
    products: string; wholesale: string; account: string
    login: string; register: string; logout: string
    cart: string; search: string
  }
  hero: {
    welcome: string; headline: string; sub: string; cta: string; cats: string
  }
  footer: {
    thanks: string; tagline: string; return: string; return2: string
    privacy: string; terms: string
    address: string; schedule: string; contact: string
  }
  catalog: {
    title: string; all: string; sortBy: string
    newest: string; priceLow: string; priceHigh: string
    noResults: string; noResultsSub: string; loading: string
    filter: string; results: string
  }
  product: {
    addToCart: string; added: string; outOfStock: string
    brand: string; category: string; sku: string
    coldFrozen: string; coldRefrig: string
    baesEligible: string; baesNotEligible: string
    quantity: string; share: string; details: string
    deliveryNote: string; frozenNote: string
  }
  cart: {
    title: string; empty: string; emptyDesc: string
    subtotal: string; shipping: string; freeShipping: string
    checkout: string; continueShopping: string
    item: string; items: string; remove: string
    baesApplied: string
  }
  checkout: {
    title: string; summary: string
    deliveryMethod: string; pickup: string; delivery: string; region: string
    name: string; phone: string; email: string; address: string; commune: string
    payOnWhatsApp: string; processing: string
    successTitle: string; successSub: string; orderNumber: string
    errorEmpty: string; errorPhone: string
  }
  account: {
    loginTitle: string; loginSub: string
    registerTitle: string; registerSub: string
    email: string; password: string; name: string
    forgotPassword: string; resetPassword: string
    myOrders: string; myProfile: string; myData: string
    welcome: string; noOrders: string; noOrdersSub: string
    save: string; saving: string; saved: string
  }
  orders: {
    title: string; number: string; date: string; status: string; total: string
    statusNew: string; statusPaid: string; statusDispatched: string
    statusDelivered: string; statusCancelled: string
    viewDetail: string; downloadBoleta: string
  }
  common: {
    loading: string; error: string; retry: string
    back: string; close: string; confirm: string; cancel: string
    optional: string; required: string; or: string
    seeAll: string; readMore: string
  }
}

const es: Dict = {
  nav: {
    products: 'PRODUCTOS',
    wholesale: 'MAYORISTA',
    account:   'MI CUENTA',
    login:     'INICIAR SESIÓN',
    register:  'REGISTRARSE',
    logout:    'CERRAR SESIÓN',
    cart:      'CARRITO',
    search:    'BUSCAR',
  },
  hero: {
    welcome:  '어서오세요 — Bienvenido',
    headline: '서울의 맛',
    sub:      'El sabor auténtico de Corea\nen el corazón de Viña del Mar',
    cta:      'Explorar tienda',
    cats:     'Ver categorías',
  },
  footer: {
    thanks:   '감사합니다',
    tagline:  'GRACIAS POR TU VISITA',
    return:   '또 오세요',
    return2:  'VUELVE PRONTO',
    privacy:  'PRIVACIDAD',
    terms:    'TÉRMINOS',
    address:  'Viña del Mar, Valparaíso, Chile',
    schedule: 'Lun–Sáb 10:00–20:00',
    contact:  'Contacto',
  },
  catalog: {
    title:       'Productos',
    all:         'Todo',
    sortBy:      'Ordenar por',
    newest:      'Más recientes',
    priceLow:    'Menor precio',
    priceHigh:   'Mayor precio',
    noResults:   'Sin resultados',
    noResultsSub:'Prueba con otra categoría o búsqueda.',
    loading:     'Cargando productos…',
    filter:      'Filtrar',
    results:     'resultados',
  },
  product: {
    addToCart:    'Agregar al carrito',
    added:        '¡Agregado!',
    outOfStock:   'Sin stock',
    brand:        'Marca',
    category:     'Categoría',
    sku:          'SKU',
    coldFrozen:   'Congelado',
    coldRefrig:   'Refrigerado',
    baesEligible: 'Elegible BAES',
    baesNotEligible: 'No elegible BAES',
    quantity:     'Cantidad',
    share:        'Compartir',
    details:      'Detalles del producto',
    deliveryNote: 'Despacho disponible en la Región de Valparaíso',
    frozenNote:   'Solo retiro en tienda o Rappi — no despacho a regiones',
  },
  cart: {
    title:          'Mi carrito',
    empty:          'Tu carrito está vacío',
    emptyDesc:      'Agrega productos coreanos para comenzar.',
    subtotal:       'Subtotal',
    shipping:       'Despacho',
    freeShipping:   'Gratis',
    checkout:       'Ir a pagar',
    continueShopping: 'Seguir comprando',
    item:           'producto',
    items:          'productos',
    remove:         'Eliminar',
    baesApplied:    'Subsidio BAES aplicado',
  },
  checkout: {
    title:          'Finalizar compra',
    summary:        'Resumen del pedido',
    deliveryMethod: 'Método de entrega',
    pickup:         'Retiro en tienda',
    delivery:       'Delivery (Rappi / Flota)',
    region:         'Envío a regiones',
    name:           'Nombre completo',
    phone:          'Teléfono',
    email:          'Correo electrónico',
    address:        'Dirección',
    commune:        'Comuna',
    payOnWhatsApp:  'Realizar pedido',
    processing:     'Procesando…',
    successTitle:   '¡Pedido enviado!',
    successSub:     'Te contactaremos por correo para coordinar el pago.',
    orderNumber:    'Número de pedido',
    errorEmpty:     'Agrega productos antes de continuar.',
    errorPhone:     'Ingresa un número de teléfono válido.',
  },
  account: {
    loginTitle:     'Iniciar sesión',
    loginSub:       'Accede a tus pedidos y perfil.',
    registerTitle:  'Crear cuenta',
    registerSub:    'Únete a la comunidad SEOUL SHOP.',
    email:          'Correo electrónico',
    password:       'Contraseña',
    name:           'Nombre completo',
    forgotPassword: '¿Olvidaste tu contraseña?',
    resetPassword:  'Restablecer contraseña',
    myOrders:       'Mis pedidos',
    myProfile:      'Mi perfil',
    myData:         'Mis datos',
    welcome:        'Bienvenido',
    noOrders:       'Aún no tienes pedidos',
    noOrdersSub:    'Cuando realices un pedido, aparecerá aquí.',
    save:           'Guardar cambios',
    saving:         'Guardando…',
    saved:          'Guardado',
  },
  orders: {
    title:            'Mis pedidos',
    number:           'N° Pedido',
    date:             'Fecha',
    status:           'Estado',
    total:            'Total',
    statusNew:        'Recibido',
    statusPaid:       'Pagado',
    statusDispatched: 'Despachado',
    statusDelivered:  'Entregado',
    statusCancelled:  'Cancelado',
    viewDetail:       'Ver detalle',
    downloadBoleta:   'Descargar boleta',
  },
  common: {
    loading:  'Cargando…',
    error:    'Ocurrió un error',
    retry:    'Reintentar',
    back:     'Volver',
    close:    'Cerrar',
    confirm:  'Confirmar',
    cancel:   'Cancelar',
    optional: '(opcional)',
    required: '(requerido)',
    or:       'o',
    seeAll:   'Ver todos',
    readMore: 'Leer más',
  },
} as const

const en: Dict = {
  nav: {
    products: 'PRODUCTS',
    wholesale: 'WHOLESALE',
    account:   'MY ACCOUNT',
    login:     'LOG IN',
    register:  'REGISTER',
    logout:    'LOG OUT',
    cart:      'CART',
    search:    'SEARCH',
  },
  hero: {
    welcome:  '어서오세요 — Welcome',
    headline: '서울의 맛',
    sub:      'Authentic Korean flavors\nin the heart of Viña del Mar',
    cta:      'Explore store',
    cats:     'View categories',
  },
  footer: {
    thanks:   '감사합니다',
    tagline:  'THANK YOU FOR VISITING',
    return:   '또 오세요',
    return2:  'COME BACK SOON',
    privacy:  'PRIVACY',
    terms:    'TERMS',
    address:  'Viña del Mar, Valparaíso, Chile',
    schedule: 'Mon–Sat 10:00–20:00',
    contact:  'Contact',
  },
  catalog: {
    title:       'Products',
    all:         'All',
    sortBy:      'Sort by',
    newest:      'Newest',
    priceLow:    'Lowest price',
    priceHigh:   'Highest price',
    noResults:   'No results',
    noResultsSub:'Try a different category or search.',
    loading:     'Loading products…',
    filter:      'Filter',
    results:     'results',
  },
  product: {
    addToCart:    'Add to cart',
    added:        'Added!',
    outOfStock:   'Out of stock',
    brand:        'Brand',
    category:     'Category',
    sku:          'SKU',
    coldFrozen:   'Frozen',
    coldRefrig:   'Refrigerated',
    baesEligible: 'BAES Eligible',
    baesNotEligible: 'Not BAES Eligible',
    quantity:     'Quantity',
    share:        'Share',
    details:      'Product details',
    deliveryNote: 'Delivery available in Valparaíso Region',
    frozenNote:   'In-store pickup or Rappi only — no regional shipping',
  },
  cart: {
    title:          'My cart',
    empty:          'Your cart is empty',
    emptyDesc:      'Add Korean products to get started.',
    subtotal:       'Subtotal',
    shipping:       'Shipping',
    freeShipping:   'Free',
    checkout:       'Checkout',
    continueShopping: 'Continue shopping',
    item:           'item',
    items:          'items',
    remove:         'Remove',
    baesApplied:    'BAES subsidy applied',
  },
  checkout: {
    title:          'Checkout',
    summary:        'Order summary',
    deliveryMethod: 'Delivery method',
    pickup:         'In-store pickup',
    delivery:       'Delivery (Rappi / Fleet)',
    region:         'Regional shipping',
    name:           'Full name',
    phone:          'Phone',
    email:          'Email',
    address:        'Address',
    commune:        'City / District',
    payOnWhatsApp:  'Place order',
    processing:     'Processing…',
    successTitle:   'Order sent!',
    successSub:     'We\'ll email you to coordinate payment.',
    orderNumber:    'Order number',
    errorEmpty:     'Add products before continuing.',
    errorPhone:     'Enter a valid phone number.',
  },
  account: {
    loginTitle:     'Log in',
    loginSub:       'Access your orders and profile.',
    registerTitle:  'Create account',
    registerSub:    'Join the SEOUL SHOP community.',
    email:          'Email',
    password:       'Password',
    name:           'Full name',
    forgotPassword: 'Forgot your password?',
    resetPassword:  'Reset password',
    myOrders:       'My orders',
    myProfile:      'My profile',
    myData:         'My data',
    welcome:        'Welcome',
    noOrders:       'No orders yet',
    noOrdersSub:    'When you place an order, it will appear here.',
    save:           'Save changes',
    saving:         'Saving…',
    saved:          'Saved',
  },
  orders: {
    title:            'My orders',
    number:           'Order #',
    date:             'Date',
    status:           'Status',
    total:            'Total',
    statusNew:        'Received',
    statusPaid:       'Paid',
    statusDispatched: 'Dispatched',
    statusDelivered:  'Delivered',
    statusCancelled:  'Cancelled',
    viewDetail:       'View detail',
    downloadBoleta:   'Download receipt',
  },
  common: {
    loading:  'Loading…',
    error:    'An error occurred',
    retry:    'Retry',
    back:     'Back',
    close:    'Close',
    confirm:  'Confirm',
    cancel:   'Cancel',
    optional: '(optional)',
    required: '(required)',
    or:       'or',
    seeAll:   'See all',
    readMore: 'Read more',
  },
}

const ko: Dict = {
  nav: {
    products: '상품',
    wholesale: '도매',
    account:   '계정',
    login:     '로그인',
    register:  '회원가입',
    logout:    '로그아웃',
    cart:      '장바구니',
    search:    '검색',
  },
  hero: {
    welcome:  '어서오세요',
    headline: '서울의 맛',
    sub:      '한국의 정통 맛을\n비냐 델 마르에서',
    cta:      '상품 보기',
    cats:     '카테고리',
  },
  footer: {
    thanks:   '감사합니다',
    tagline:  '방문해 주셔서 감사합니다',
    return:   '또 오세요',
    return2:  '다음에 또 와주세요',
    privacy:  '개인정보처리방침',
    terms:    '이용약관',
    address:  '칠레 발파라이소 비냐 델 마르',
    schedule: '월-토 10:00–20:00',
    contact:  '연락처',
  },
  catalog: {
    title:       '상품',
    all:         '전체',
    sortBy:      '정렬',
    newest:      '최신순',
    priceLow:    '낮은 가격순',
    priceHigh:   '높은 가격순',
    noResults:   '결과 없음',
    noResultsSub:'다른 카테고리나 검색어를 시도해보세요.',
    loading:     '상품 불러오는 중…',
    filter:      '필터',
    results:     '결과',
  },
  product: {
    addToCart:    '장바구니에 담기',
    added:        '담겼습니다!',
    outOfStock:   '품절',
    brand:        '브랜드',
    category:     '카테고리',
    sku:          'SKU',
    coldFrozen:   '냉동',
    coldRefrig:   '냉장',
    baesEligible: 'BAES 대상',
    baesNotEligible: 'BAES 비대상',
    quantity:     '수량',
    share:        '공유',
    details:      '상품 상세',
    deliveryNote: '발파라이소 지역 배송 가능',
    frozenNote:   '매장 픽업 또는 Rappi만 — 지역 배송 불가',
  },
  cart: {
    title:          '장바구니',
    empty:          '장바구니가 비어 있습니다',
    emptyDesc:      '한국 상품을 추가해보세요.',
    subtotal:       '소계',
    shipping:       '배송비',
    freeShipping:   '무료',
    checkout:       '결제하기',
    continueShopping: '쇼핑 계속하기',
    item:           '개',
    items:          '개',
    remove:         '삭제',
    baesApplied:    'BAES 지원금 적용됨',
  },
  checkout: {
    title:          '주문 완료',
    summary:        '주문 요약',
    deliveryMethod: '배송 방법',
    pickup:         '매장 픽업',
    delivery:       '배달 (Rappi / 자체배달)',
    region:         '지역 배송',
    name:           '이름',
    phone:          '전화번호',
    email:          '이메일',
    address:        '주소',
    commune:        '지역',
    payOnWhatsApp:  '주문하기',
    processing:     '처리 중…',
    successTitle:   '주문 완료!',
    successSub:     '이메일로 결제 안내를 드리겠습니다.',
    orderNumber:    '주문번호',
    errorEmpty:     '상품을 먼저 추가해주세요.',
    errorPhone:     '유효한 전화번호를 입력해주세요.',
  },
  account: {
    loginTitle:     '로그인',
    loginSub:       '주문 내역과 프로필에 접근하세요.',
    registerTitle:  '회원가입',
    registerSub:    'SEOUL SHOP 커뮤니티에 참여하세요.',
    email:          '이메일',
    password:       '비밀번호',
    name:           '이름',
    forgotPassword: '비밀번호를 잊으셨나요?',
    resetPassword:  '비밀번호 재설정',
    myOrders:       '내 주문',
    myProfile:      '내 프로필',
    myData:         '내 정보',
    welcome:        '환영합니다',
    noOrders:       '아직 주문이 없습니다',
    noOrdersSub:    '주문하시면 여기에 표시됩니다.',
    save:           '변경 사항 저장',
    saving:         '저장 중…',
    saved:          '저장됨',
  },
  orders: {
    title:            '내 주문',
    number:           '주문번호',
    date:             '날짜',
    status:           '상태',
    total:            '합계',
    statusNew:        '접수됨',
    statusPaid:       '결제됨',
    statusDispatched: '발송됨',
    statusDelivered:  '배달완료',
    statusCancelled:  '취소됨',
    viewDetail:       '상세 보기',
    downloadBoleta:   '영수증 다운로드',
  },
  common: {
    loading:  '불러오는 중…',
    error:    '오류가 발생했습니다',
    retry:    '다시 시도',
    back:     '뒤로',
    close:    '닫기',
    confirm:  '확인',
    cancel:   '취소',
    optional: '(선택)',
    required: '(필수)',
    or:       '또는',
    seeAll:   '전체 보기',
    readMore: '더 보기',
  },
}

const dictionaries: Record<Locale, Dict> = { es, en, ko }

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale] ?? dictionaries.es
}

export type { Dict }
