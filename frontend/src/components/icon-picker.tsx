import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CATEGORY_ICONS, isEmoji, extractFirstEmoji } from '@/lib/category-icons'
import { cn } from '@/lib/utils'

interface IconPickerProps {
  value: string
  color: string
  onChange: (iconName: string) => void
}

export function IconPicker({ value, color, onChange }: IconPickerProps) {
  const { t } = useTranslation()
  const isCurrentEmoji = isEmoji(value)
  const [tab, setTab] = useState<'icons' | 'emojis'>(() => (isCurrentEmoji ? 'emojis' : 'icons'))
  const [search, setSearch] = useState('')

  const detectedSearchEmoji = useMemo(() => extractFirstEmoji(search), [search])

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return CATEGORY_ICONS
    const q = search.toLowerCase()
    return CATEGORY_ICONS.filter(
      (entry) =>
        entry.name.includes(q) ||
        entry.label.toLowerCase().includes(q)
    )
  }, [search])

  const filteredEmojis = useMemo(() => {
    const base = CATEGORY_ICONS.map((entry) => ({
      emoji: entry.emoji,
      label: entry.label,
      name: entry.name,
    }))

    // If search contains a custom emoji not in standard list, put it first
    let result = base
    if (detectedSearchEmoji && !base.some((e) => e.emoji === detectedSearchEmoji)) {
      result = [{ emoji: detectedSearchEmoji, label: 'Custom', name: 'custom' }, ...result]
    } else if (isCurrentEmoji && !base.some((e) => e.emoji === value)) {
      result = [{ emoji: value, label: 'Custom', name: 'custom' }, ...result]
    }

    if (!search.trim() || detectedSearchEmoji) return result

    const q = search.toLowerCase()
    return result.filter(
      (entry) =>
        entry.name.includes(q) ||
        entry.label.toLowerCase().includes(q) ||
        entry.emoji.includes(q)
    )
  }, [search, detectedSearchEmoji, isCurrentEmoji, value])

  const handleApplyEmoji = (emoji: string) => {
    if (emoji) {
      onChange(emoji)
      setSearch('')
      setTab('emojis')
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Mode Switcher: Icons vs Emojis */}
      <div className="flex items-center gap-1 p-0.5 bg-muted rounded-lg text-xs font-medium">
        <button
          type="button"
          onClick={() => setTab('icons')}
          className={cn(
            'flex-1 py-1.5 px-3 rounded-md transition-all text-center cursor-pointer',
            tab === 'icons'
              ? 'bg-card text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t('common.icons', 'Icons')}
        </button>
        <button
          type="button"
          onClick={() => setTab('emojis')}
          className={cn(
            'flex-1 py-1.5 px-3 rounded-md transition-all text-center cursor-pointer',
            tab === 'emojis'
              ? 'bg-card text-foreground shadow-xs font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t('common.emojis', 'Emojis')}
        </button>
      </div>

      {/* Unified Search & Emoji Input Bar */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder={
            tab === 'icons'
              ? t('common.searchIconOrEmoji', 'Search icon or paste emoji...')
              : t('common.searchOrPasteEmoji', 'Search or paste emoji (e.g. 🍕, 🚀)...')
          }
          className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (detectedSearchEmoji) {
                handleApplyEmoji(detectedSearchEmoji)
              }
            }
          }}
        />

        {/* Global Emoji Detection Action Banner */}
        {detectedSearchEmoji && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none">{detectedSearchEmoji}</span>
              <span className="text-xs text-foreground font-medium">
                {t('common.useEmoji', {
                  emoji: detectedSearchEmoji,
                  defaultValue: `Use emoji ${detectedSearchEmoji}`,
                })}
              </span>
            </div>
            <button
              type="button"
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
              onClick={() => handleApplyEmoji(detectedSearchEmoji)}
            >
              {t('common.select', 'Select')}
            </button>
          </div>
        )}
      </div>

      {/* Content Grid */}
      {tab === 'icons' ? (
        /* Lucide Icons View */
        <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto p-1">
          {filteredIcons.map((entry) => {
            const isSelected = value === entry.name
            const Icon = entry.icon
            return (
              <button
                key={entry.name}
                type="button"
                title={entry.label}
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer',
                  isSelected
                    ? 'ring-2 ring-offset-1 ring-primary'
                    : 'hover:bg-muted'
                )}
                style={isSelected ? { backgroundColor: color || '#6B7280' } : undefined}
                onClick={() => onChange(entry.name)}
              >
                <Icon
                  size={18}
                  className={isSelected ? 'text-white' : 'text-muted-foreground'}
                  strokeWidth={2}
                />
              </button>
            )
          })}
          {filteredIcons.length === 0 && !detectedSearchEmoji && (
            <p className="col-span-8 text-xs text-muted-foreground text-center py-4">
              {t('common.noIconsFound')}
            </p>
          )}
        </div>
      ) : (
        /* Emojis View */
        <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto p-1">
          {filteredEmojis.map((entry, index) => {
            const isSelected = value === entry.emoji
            return (
              <button
                key={`${entry.emoji}-${index}`}
                type="button"
                title={entry.label}
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer text-lg select-none',
                  isSelected
                    ? 'ring-2 ring-offset-1 ring-primary'
                    : 'hover:bg-muted'
                )}
                style={isSelected ? { backgroundColor: color || '#6B7280' } : undefined}
                onClick={() => onChange(entry.emoji)}
              >
                <span>{entry.emoji}</span>
              </button>
            )
          })}
          {filteredEmojis.length === 0 && !detectedSearchEmoji && (
            <p className="col-span-8 text-xs text-muted-foreground text-center py-4">
              {t('common.noEmojisFound', 'No emojis found')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
