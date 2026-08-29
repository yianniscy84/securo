import type { LucideIcon } from 'lucide-react'
import {
  House, UtensilsCrossed, Car, ShoppingCart, Pill, Gamepad2,
  Smartphone, BookOpen, ArrowLeftRight, CircleHelp,
  Wallet, CreditCard, Banknote, PiggyBank, TrendingUp, TrendingDown,
  Receipt, ShoppingBag, Gift, Heart, Baby, Dog, Cat,
  Plane, Train, Bus, Fuel, Bike,
  Lightbulb, Droplets, Flame, Wifi, Tv,
  GraduationCap, Briefcase, Building2, Landmark,
  Dumbbell, Shirt, Scissors, Wrench, Hammer,
  Music, Film, Coffee, Beer, Pizza, Salad,
  Stethoscope, Syringe, Cross,
  PartyPopper, TreePine, Umbrella, Globe, Sparkles
} from 'lucide-react'

export interface CategoryIconEntry {
  name: string      // Lucide icon name (stored in DB)
  label: string     // Portuguese label for search
  icon: LucideIcon  // Component reference
  emoji: string     // Equivalent emoji
}

export const CATEGORY_ICONS: CategoryIconEntry[] = [
  // Moradia & Casa
  { name: 'house', label: 'Casa / Moradia', icon: House, emoji: '🏠' },
  { name: 'lightbulb', label: 'Luz / Energia', icon: Lightbulb, emoji: '💡' },
  { name: 'droplets', label: 'Água', icon: Droplets, emoji: '💧' },
  { name: 'flame', label: 'Gás', icon: Flame, emoji: '🔥' },
  { name: 'wifi', label: 'Internet / Wi-Fi', icon: Wifi, emoji: '📶' },
  { name: 'tv', label: 'TV / Streaming', icon: Tv, emoji: '📺' },
  // Alimentação
  { name: 'utensils-crossed', label: 'Alimentação / Restaurante', icon: UtensilsCrossed, emoji: '🍽️' },
  { name: 'coffee', label: 'Café', icon: Coffee, emoji: '☕' },
  { name: 'beer', label: 'Bebidas / Bar', icon: Beer, emoji: '🍺' },
  { name: 'pizza', label: 'Pizza / Fast Food', icon: Pizza, emoji: '🍕' },
  { name: 'salad', label: 'Salada / Saudável', icon: Salad, emoji: '🥗' },
  // Transporte
  { name: 'car', label: 'Carro / Transporte', icon: Car, emoji: '🚗' },
  { name: 'fuel', label: 'Combustível / Gasolina', icon: Fuel, emoji: '⛽' },
  { name: 'bus', label: 'Ônibus', icon: Bus, emoji: '🚌' },
  { name: 'train', label: 'Trem / Metrô', icon: Train, emoji: '🚆' },
  { name: 'plane', label: 'Avião / Viagem', icon: Plane, emoji: '✈️' },
  { name: 'bike', label: 'Bicicleta', icon: Bike, emoji: '🚲' },
  // Compras
  { name: 'shopping-cart', label: 'Mercado / Supermercado', icon: ShoppingCart, emoji: '🛒' },
  { name: 'shopping-bag', label: 'Compras / Loja', icon: ShoppingBag, emoji: '🛍️' },
  { name: 'gift', label: 'Presente', icon: Gift, emoji: '🎁' },
  { name: 'shirt', label: 'Roupa / Vestuário', icon: Shirt, emoji: '👕' },
  // Saúde
  { name: 'pill', label: 'Remédio / Farmácia', icon: Pill, emoji: '💊' },
  { name: 'stethoscope', label: 'Médico / Consulta', icon: Stethoscope, emoji: '🩺' },
  { name: 'syringe', label: 'Vacina / Exame', icon: Syringe, emoji: '💉' },
  { name: 'cross', label: 'Hospital / Emergência', icon: Cross, emoji: '🏥' },
  { name: 'heart', label: 'Saúde / Bem-estar', icon: Heart, emoji: '❤️' },
  { name: 'dumbbell', label: 'Academia / Exercício', icon: Dumbbell, emoji: '🏋️' },
  // Lazer
  { name: 'gamepad-2', label: 'Jogos / Lazer', icon: Gamepad2, emoji: '🎮' },
  { name: 'music', label: 'Música', icon: Music, emoji: '🎵' },
  { name: 'film', label: 'Cinema / Filme', icon: Film, emoji: '🎬' },
  { name: 'party-popper', label: 'Festa / Evento', icon: PartyPopper, emoji: '🎉' },
  // Tecnologia & Assinaturas
  { name: 'smartphone', label: 'Celular / Telefone', icon: Smartphone, emoji: '📱' },
  { name: 'credit-card', label: 'Cartão de Crédito', icon: CreditCard, emoji: '💳' },
  // Educação
  { name: 'book-open', label: 'Livro / Leitura', icon: BookOpen, emoji: '📚' },
  { name: 'graduation-cap', label: 'Educação / Curso', icon: GraduationCap, emoji: '🎓' },
  // Trabalho & Negócios
  { name: 'briefcase', label: 'Trabalho / Negócios', icon: Briefcase, emoji: '💼' },
  { name: 'building-2', label: 'Empresa / Escritório', icon: Building2, emoji: '🏢' },
  { name: 'landmark', label: 'Banco / Governo', icon: Landmark, emoji: '🏛️' },
  // Finanças
  { name: 'wallet', label: 'Carteira', icon: Wallet, emoji: '👛' },
  { name: 'banknote', label: 'Dinheiro', icon: Banknote, emoji: '💵' },
  { name: 'piggy-bank', label: 'Poupança / Investimento', icon: PiggyBank, emoji: '🐷' },
  { name: 'trending-up', label: 'Rendimento / Lucro', icon: TrendingUp, emoji: '📈' },
  { name: 'trending-down', label: 'Prejuízo / Perda', icon: TrendingDown, emoji: '📉' },
  { name: 'receipt', label: 'Recibo / Nota Fiscal', icon: Receipt, emoji: '🧾' },
  { name: 'arrow-left-right', label: 'Transferência', icon: ArrowLeftRight, emoji: '🔄' },
  // Família & Pets
  { name: 'baby', label: 'Bebê / Criança', icon: Baby, emoji: '👶' },
  { name: 'dog', label: 'Pet / Cachorro', icon: Dog, emoji: '🐶' },
  { name: 'cat', label: 'Pet / Gato', icon: Cat, emoji: '🐱' },
  // Serviços & Manutenção
  { name: 'scissors', label: 'Cabelo / Beleza', icon: Scissors, emoji: '✂️' },
  { name: 'wrench', label: 'Manutenção / Reparo', icon: Wrench, emoji: '🔧' },
  { name: 'hammer', label: 'Construção / Reforma', icon: Hammer, emoji: '🔨' },
  // Outros
  { name: 'tree-pine', label: 'Natureza / Jardim', icon: TreePine, emoji: '🌲' },
  { name: 'umbrella', label: 'Seguro', icon: Umbrella, emoji: '☂️' },
  { name: 'globe', label: 'Internacional', icon: Globe, emoji: '🌐' },
  { name: 'sparkles', label: 'Especial', icon: Sparkles, emoji: '✨' },
  { name: 'circle-help', label: 'Outros / Indefinido', icon: CircleHelp, emoji: '❓' },
]

// O(1) lookup map: icon-name → LucideIcon component
export const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_ICONS.map((entry) => [entry.name, entry.icon])
)

// Mapping from Lucide name to equivalent emoji
export const LUCIDE_TO_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORY_ICONS.map((entry) => [entry.name, entry.emoji])
)

// Mapping from Emoji to equivalent Lucide name
export const EMOJI_TO_LUCIDE: Record<string, string> = Object.fromEntries(
  CATEGORY_ICONS.map((entry) => [entry.emoji, entry.name])
)


// Matches single or composite emoji sequences (e.g. 🏠, 🍕, 🇧🇷, 👨‍👩‍👧, 👍🏽, ✈️)
const EMOJI_MATCH_REGEX = /(?:\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\u200D|\p{Emoji_Modifier}|\p{Extended_Pictographic}|\p{Regional_Indicator})*)/u
const EXACT_EMOJI_REGEX = /^(?:\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\u200D|\p{Emoji_Modifier}|\p{Extended_Pictographic}|\p{Regional_Indicator})*)$/u

// Popular curated emojis for quick category/goal picking
export const POPULAR_EMOJIS: string[] = [
  '🏠', '🛒', '🍔', '🍕', '☕', '🍺', '🚗', '⛽',
  '🚌', '✈️', '💊', '🏥', '🏋️', '🎮', '🎬', '🎵',
  '📱', '💻', '📚', '🎓', '💼', '💰', '💳', '📈',
  '📉', '🎁', '🐶', '🐱', '👶', '👕', '✂️', '🔧',
  '⚡', '💧', '🔥', '🌐', '🌴', '🏖️', '🎉', '✨',
]

// Check if a string is an emoji
export function isEmoji(str: string | null | undefined): boolean {
  if (!str) return false
  const trimmed = str.trim()
  if (!trimmed) return false
  return EXACT_EMOJI_REGEX.test(trimmed)
}

// Extract the first emoji sequence from a string (useful when pasting or typing)
export function extractFirstEmoji(str: string | null | undefined): string | null {
  if (!str) return null
  const match = str.match(EMOJI_MATCH_REGEX)
  return match ? match[0] : null
}

