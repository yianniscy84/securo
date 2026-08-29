import { describe, it, expect } from 'vitest'
import {
  isEmoji,
  extractFirstEmoji,
  ICON_MAP,
  CATEGORY_ICONS,
  LUCIDE_TO_EMOJI,
  EMOJI_TO_LUCIDE,
} from './category-icons'

describe('category-icons emoji utilities', () => {
  describe('isEmoji', () => {
    it('returns true for single standard emojis', () => {
      expect(isEmoji('🏠')).toBe(true)
      expect(isEmoji('🍕')).toBe(true)
      expect(isEmoji('🚗')).toBe(true)
      expect(isEmoji('💊')).toBe(true)
      expect(isEmoji('🎉')).toBe(true)
    })

    it('returns true for emojis with variation selectors or modifiers', () => {
      expect(isEmoji('✈️')).toBe(true)
      expect(isEmoji('⚡️')).toBe(true)
      expect(isEmoji('❤️')).toBe(true)
      expect(isEmoji('👍🏽')).toBe(true)
      expect(isEmoji('🏋️')).toBe(true)
    })

    it('returns true for compound ZWJ emojis and flags', () => {
      expect(isEmoji('🇧🇷')).toBe(true)
      expect(isEmoji('🇺🇸')).toBe(true)
      expect(isEmoji('👨‍👩‍👧')).toBe(true)
      expect(isEmoji('👩‍💻')).toBe(true)
    })

    it('returns false for Lucide icon names and standard text', () => {
      expect(isEmoji('house')).toBe(false)
      expect(isEmoji('car')).toBe(false)
      expect(isEmoji('shopping-cart')).toBe(false)
      expect(isEmoji('circle-help')).toBe(false)
      expect(isEmoji('tag')).toBe(false)
      expect(isEmoji('123')).toBe(false)
      expect(isEmoji('hello')).toBe(false)
    })

    it('returns false for null, undefined, or empty strings', () => {
      expect(isEmoji(null)).toBe(false)
      expect(isEmoji(undefined)).toBe(false)
      expect(isEmoji('')).toBe(false)
      expect(isEmoji('   ')).toBe(false)
    })
  })

  describe('extractFirstEmoji', () => {
    it('extracts emoji from plain emoji or mixed text', () => {
      expect(extractFirstEmoji('🍕')).toBe('🍕')
      expect(extractFirstEmoji('pizza 🍕 yummy')).toBe('🍕')
      expect(extractFirstEmoji('🇧🇷 Brazil')).toBe('🇧🇷')
      expect(extractFirstEmoji('Work 💼')).toBe('💼')
    })

    it('returns null when no emoji is present', () => {
      expect(extractFirstEmoji('house')).toBe(null)
      expect(extractFirstEmoji('shopping-cart')).toBe(null)
      expect(extractFirstEmoji('')).toBe(null)
      expect(extractFirstEmoji(null)).toBe(null)
      expect(extractFirstEmoji(undefined)).toBe(null)
    })
  })

  describe('ICON_MAP, LUCIDE_TO_EMOJI and EMOJI_TO_LUCIDE', () => {
    it('contains all entries defined in CATEGORY_ICONS', () => {
      for (const entry of CATEGORY_ICONS) {
        expect(ICON_MAP[entry.name]).toBeDefined()
        expect(entry.emoji).toBeDefined()
        expect(isEmoji(entry.emoji)).toBe(true)
        expect(LUCIDE_TO_EMOJI[entry.name]).toBe(entry.emoji)
        expect(EMOJI_TO_LUCIDE[entry.emoji]).toBeDefined()
      }
    })
  })
})
