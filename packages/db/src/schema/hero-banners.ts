import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core'

export const heroBanners = pgTable('hero_banners', {
  id:          uuid('id').primaryKey().defaultRandom(),
  titleEs:     text('title_es').notNull(),
  titleKo:     text('title_ko'),
  titleEn:     text('title_en'),
  subtitleEs:  text('subtitle_es'),
  subtitleKo:  text('subtitle_ko'),
  subtitleEn:  text('subtitle_en'),
  imageUrl:    text('image_url'),
  ctaLabelEs:  text('cta_label_es'),
  ctaLabelKo:  text('cta_label_ko'),
  ctaLabelEn:  text('cta_label_en'),
  ctaHref:     text('cta_href'),
  sortOrder:   integer('sort_order').notNull().default(0),
  active:      boolean('active').notNull().default(true),
  startsAt:    timestamp('starts_at'),
  endsAt:      timestamp('ends_at'),
  createdAt:   timestamp('created_at').defaultNow(),
})
