import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core'

export const faqEntries = pgTable('faq_entries', {
  id:         uuid('id').primaryKey().defaultRandom(),
  questionEs: text('question_es').notNull(),
  questionKo: text('question_ko'),
  questionEn: text('question_en'),
  answerEs:   text('answer_es').notNull(),
  answerKo:   text('answer_ko'),
  answerEn:   text('answer_en'),
  category:   text('category').notNull().default('general'),
  // 'envios' | 'pago' | 'productos' | 'baes' | 'devoluciones' | 'general'
  sortOrder:  integer('sort_order').notNull().default(0),
  active:     boolean('active').notNull().default(true),
  createdAt:  timestamp('created_at').defaultNow(),
})
