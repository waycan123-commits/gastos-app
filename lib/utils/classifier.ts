export const DEFAULT_CATEGORIES = [
  { name: 'Comida', icon: '🍽️', color: '#f59e0b' },
  { name: 'Transporte', icon: '🚗', color: '#3b82f6' },
  { name: 'Vivienda', icon: '🏠', color: '#8b5cf6' },
  { name: 'Servicios', icon: '💡', color: '#06b6d4' },
  { name: 'Educación', icon: '📚', color: '#10b981' },
  { name: 'Salud', icon: '🏥', color: '#ef4444' },
  { name: 'Entretenimiento', icon: '🎬', color: '#ec4899' },
  { name: 'Compras', icon: '🛍️', color: '#f97316' },
  { name: 'Suscripciones', icon: '📱', color: '#6366f1' },
  { name: 'Deudas / Tarjeta', icon: '💳', color: '#dc2626' },
  { name: 'Otros', icon: '📦', color: '#6b7280' },
]

const CLASSIFICATION_RULES: Record<string, string[]> = {
  Comida: [
    'restaurante', 'restaurant', 'café', 'cafe', 'delivery', 'supermercado', 'supermarket',
    'pizza', 'burger', 'pollo', 'sushi', 'comida', 'food', 'mercado', 'bodega',
    'panadería', 'pollería', 'chifa', 'cevichería', 'buffet', 'desayuno', 'almuerzo',
    'cena', 'mcdonald', 'kfc', 'subway', 'rappi', 'ubereats', 'glovo', 'pedidosya',
    'wong', 'plaza vea', 'tottus', 'metro', 'vivanda', 'makro',
  ],
  Transporte: [
    'uber', 'taxi', 'bus', 'gasolina', 'combustible', 'transporte', 'metro',
    'tren', 'avión', 'vuelo', 'pasaje', 'peaje', 'estacionamiento', 'cabify',
    'indriver', 'beat', 'colectivo', 'mototaxi', 'parking',
  ],
  Vivienda: [
    'alquiler', 'renta', 'hipoteca', 'condominio', 'mantenimiento', 'vivienda',
    'casa', 'departamento', 'habitación', 'arrendamiento',
  ],
  Servicios: [
    'luz', 'agua', 'internet', 'celular', 'gas', 'cable', 'telefono', 'teléfono',
    'entel', 'claro', 'movistar', 'bitel', 'enel', 'sedapal', 'cálidda',
    'electricidad', 'wifi', 'servicio',
  ],
  Educación: [
    'colegio', 'universidad', 'curso', 'libro', 'educación', 'academia',
    'clases', 'tutoría', 'matrícula', 'mensualidad escolar', 'udemy', 'coursera',
    'platzi', 'instituto', 'capacitación',
  ],
  Salud: [
    'farmacia', 'clínica', 'doctor', 'médico', 'salud', 'hospital', 'dentista',
    'óptica', 'medicina', 'consulta', 'laboratorio', 'inkafarma', 'mifarma',
    'botica', 'seguro médico', 'eps',
  ],
  Entretenimiento: [
    'cine', 'teatro', 'concierto', 'parque', 'juego', 'videojuego', 'entretenimiento',
    'evento', 'club', 'bar', 'discoteca', 'bowling', 'karaoke',
  ],
  Compras: [
    'mall', 'tienda', 'ropa', 'ecommerce', 'amazon', 'mercadolibre', 'falabella',
    'ripley', 'saga', 'oechsle', 'compra', 'calzado', 'zapatería', 'electrónica',
    'electrodoméstico', 'muebles',
  ],
  Suscripciones: [
    'netflix', 'spotify', 'disney', 'prime', 'hbo', 'apple', 'youtube premium',
    'suscripción', 'subscripción', 'membresía', 'plan mensual', 'adobe', 'dropbox',
    'microsoft', 'google one', 'chatgpt', 'openai',
  ],
  'Deudas / Tarjeta': [
    'banco', 'tarjeta', 'cuota', 'interés', 'deuda', 'crédito', 'préstamo',
    'financiamiento', 'bcp', 'bbva', 'interbank', 'scotiabank', 'banbif',
    'mibanco', 'pago de tarjeta', 'cuota de crédito',
  ],
}

export function classifyTransaction(description: string): string {
  const lower = description.toLowerCase()

  for (const [category, keywords] of Object.entries(CLASSIFICATION_RULES)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category
    }
  }

  return 'Otros'
}

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  suggestedCategory: string
}

export function parseStatementText(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const lines = text.split('\n').filter(l => l.trim().length > 0)

  // Multiple regex patterns for different bank formats
  const patterns = [
    // DD/MM/YYYY or DD-MM-YYYY followed by description and amount
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([S\/\.\$]?\s*[\d,\.]+)\s*$/,
    // Amount at beginning: S/ 123.45 description DD/MM
    /([S\/\.\$]?\s*[\d,\.]+)\s+(.+?)\s+(\d{1,2}[\/\-]\d{1,2})/,
    // Tab-separated
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\t(.+?)\t([\d,\.]+)/,
  ]

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length < 5) continue

    for (const pattern of patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        const amountStr = (match[3] || match[1]).replace(/[S\/\.\$ ]/g, '').replace(',', '.')
        const amount = parseFloat(amountStr)
        if (isNaN(amount) || amount <= 0) continue

        const description = (match[2] || match[3]).trim()
        const dateStr = match[1] || match[3]

        let formattedDate = new Date().toISOString().split('T')[0]
        try {
          const parts = dateStr.split(/[\/\-]/)
          if (parts.length >= 2) {
            const day = parts[0].padStart(2, '0')
            const month = parts[1].padStart(2, '0')
            const year = parts[2]
              ? (parts[2].length === 2 ? `20${parts[2]}` : parts[2])
              : new Date().getFullYear().toString()
            formattedDate = `${year}-${month}-${day}`
          }
        } catch {}

        transactions.push({
          date: formattedDate,
          description,
          amount,
          suggestedCategory: classifyTransaction(description),
        })
        break
      }
    }
  }

  // Fallback: look for any line with a number that looks like money
  if (transactions.length === 0) {
    const moneyPattern = /(.+?)\s+([S\/\$]?\s*[\d]+[,\.][\d]{2})\s*$/
    for (const line of lines) {
      const match = line.trim().match(moneyPattern)
      if (match) {
        const amountStr = match[2].replace(/[S\/\$ ]/g, '').replace(',', '.')
        const amount = parseFloat(amountStr)
        if (!isNaN(amount) && amount > 0) {
          transactions.push({
            date: new Date().toISOString().split('T')[0],
            description: match[1].trim(),
            amount,
            suggestedCategory: classifyTransaction(match[1]),
          })
        }
      }
    }
  }

  return transactions
}
