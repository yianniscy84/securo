import { useRef, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  categories as categoriesApi,
  categoryGroups as categoryGroupsApi,
  rules as rulesApi,
  accounts as accountsApi,
  payees as payeesApi,
} from '@/lib/api'
import { extractApiError } from '@/lib/api-errors'
import { invalidateFinancialQueries } from '@/lib/invalidate-queries'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type {
  Category,
  Payee,
  Rule,
  RuleAction,
  RuleCondition,
  RuleConditionNode,
  RuleExportPayload,
} from '@/types'
import { flattenConditions, isConditionGroup } from '@/lib/rule-conditions'
import {
  Trash2,
  Plus,
  RefreshCw,
  Package,
  Check,
  Download,
  Upload,
  Search,
  X,
  GripVertical,
  Copy,
  AlertTriangle,
  ArrowUpDown,
  ListFilter,
  Activity,
  Tag,
  Store,
  EyeClosed,
  Hash,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { useWorkspace } from '@/contexts/workspace-context'
import { RuleDialog } from '@/components/rule-dialog'
import { findCategoryReference } from '@/lib/category-reference-utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CategoryFilterContent } from '@/components/category-filter-content'



const CONDITION_FIELDS = [
  { value: 'description', label: 'rules.fieldDescription' },
  { value: 'payee', label: 'rules.fieldRawPayee' },
  { value: 'notes', label: 'rules.fieldNotes' },
  { value: 'amount', label: 'rules.fieldAmount' },
  { value: 'type', label: 'rules.fieldType' },
  { value: 'account_id', label: 'rules.fieldAccount' },
  { value: 'payee_id', label: 'rules.fieldPayee' },
  { value: 'date', label: 'rules.fieldDate' },
] as const

const STRING_OPS = [
  { value: 'contains', label: 'rules.opContains' },
  { value: 'not_contains', label: 'rules.opNotContains' },
  { value: 'equals', label: 'rules.opEquals' },
  { value: 'not_equals', label: 'rules.opNotEquals' },
  { value: 'starts_with', label: 'rules.opStartsWith' },
  { value: 'ends_with', label: 'rules.opEndsWith' },
  { value: 'regex', label: 'rules.opRegex' },
]

const NUMERIC_OPS = [
  { value: 'equals', label: '=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
]

function getOpsForField(field: string) {
  if (field === 'amount' || field === 'date') return NUMERIC_OPS
  if (field === 'type') return [{ value: 'equals', label: 'rules.opIs' }]
  if (field === 'payee_id' || field === 'account_id') return [
    { value: 'equals', label: 'rules.opIs' },
    { value: 'not_equals', label: 'rules.opIsNot' },
  ]
  return STRING_OPS
}

function conditionSummary(
  conditions: RuleConditionNode[],
  conditionsOp: string,
  t: (key: string, opt?: Record<string, unknown>) => string,
  payeesList: Payee[],
): string {
  const fieldLabel = (f: string) => {
    const key = CONDITION_FIELDS.find(x => x.value === f)?.label
    return key ? t(key) : f
  }
  const opLabel = (f: string, op: string) => {
    const key = getOpsForField(f).find(x => x.value === op)?.label
    return key ? t(key) : op
  }
  const valueLabel = (c: RuleCondition) => {
    if (c.field === 'payee_id') {
      const p = payeesList.find(p => p.id === c.value)
      return p ? p.name : String(c.value)
    }
    return String(c.value)
  }
  const leafSummary = (c: RuleCondition) => `${fieldLabel(c.field)} ${opLabel(c.field, c.op)} "${valueLabel(c)}"`
  const joiner = (op: string) => ` ${op === 'or' ? t('rules.orOp') : t('rules.andOp')} `
  const parts = conditions.map(node => (
    isConditionGroup(node)
      ? `(${node.conditions.map(leafSummary).join(joiner(node.op))})`
      : leafSummary(node)
  ))
  return parts.join(joiner(conditionsOp)) || t('rules.noConditions')
}

function actionSummary(
  actions: RuleAction[],
  categories: Category[],
  payeesList: Payee[],
  t: (key: string, opt?: Record<string, unknown>) => string,
): string {
  return actions.map(a => {
    if (a.op === 'set_category') {
      const cat = findCategoryReference(categories, a.value)
      return cat ? `→ ${cat.name}` : `→ ${t('transactions.category')}`
    }
    if (a.op === 'set_payee') {
      const p = payeesList.find(p => p.id === a.value)
      return p ? `→ ${t('payees.payee')}: ${p.name}` : `→ ${t('payees.payee')}`
    }
    if (a.op === 'set_description') {
      return `→ ${t('rules.fieldDescription')}: ${a.value}`
    }
    if (a.op === 'append_notes') return `→ ${t('rules.fieldNotes')}: ${a.value}`
    if (a.op === 'ignore') return `→ ${t('rules.ignoreAction')}`
    return a.op
  }).join('  ') || t('rules.noActions')
}

interface FilterChipProps {
  icon: React.ReactNode
  label: string
  value: string
  tint?: string
  onRemove: () => void
}

function FilterChip({ icon, label, value, tint, onRemove }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 pl-2 pr-1.5 text-[11.5px] text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5"
      style={tint ? { borderColor: `${tint}55`, backgroundColor: `${tint}12` } : undefined}
    >
      <span
        className="flex items-center text-muted-foreground group-hover:text-destructive"
        style={tint ? { color: tint } : undefined}
      >
        {icon}
      </span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="max-w-[140px] truncate font-medium text-foreground">
        {value}
      </span>
      <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 group-hover:text-destructive">
        <X size={11} />
      </span>
    </button>
  )
}

interface ImportPreAnalysisItem {
  name: string
  valid: boolean
  reason?: string
}

interface ImportPreAnalysis {
  total: number
  readyCount: number
  skippedCount: number
  categoriesToCreate: string[]
  items: ImportPreAnalysisItem[]
}

export default function RulesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { canWrite } = useWorkspace()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [packsDialogOpen, setPacksDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<RuleExportPayload | null>(null)
  const [pendingImportName, setPendingImportName] = useState('')
  const [createMissingCategories, setCreateMissingCategories] = useState(true)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [editing, setEditing] = useState<Rule | null>(null)
  const [deletingRule, setDeletingRule] = useState<Rule | null>(null)
  const [dialogInstance, setDialogInstance] = useState(0)

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [categoryFilterIds, setCategoryFilterIds] = useState<string[]>([])
  const [filterPayeeId, setFilterPayeeId] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterIgnore, setFilterIgnore] = useState(false)
  const [sortBy, setSortBy] = useState<'execution' | 'name_asc' | 'name_desc' | 'category_asc' | 'category_desc'>('execution')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [statusSubOpen, setStatusSubOpen] = useState(false)
  const [categorySubOpen, setCategorySubOpen] = useState(false)
  const keepCategorySubOpenRef = useRef(false)

  // Drag & drop state
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<{ id: string; pos: 'before' | 'after' } | null>(null)

  function openCreate() {
    setEditing(null)
    setDialogInstance((n) => n + 1)
    setDialogOpen(true)
  }

  function openEdit(rule: Rule) {
    setEditing(rule)
    setDialogInstance((n) => n + 1)
    setDialogOpen(true)
  }

  const { data: rulesList } = useQuery({
    queryKey: ['rules'],
    queryFn: rulesApi.list,
  })

  const { data: categoriesList } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  })

  const { data: allCategoriesList } = useQuery({
    queryKey: ['categories', 'management'],
    queryFn: categoriesApi.listIncludingHidden,
  })

  const { data: categoryGroupsList } = useQuery({
    queryKey: ['categoryGroups'],
    queryFn: categoryGroupsApi.list,
  })

  const { data: accountsList } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(),
  })

  const { data: payeesList } = useQuery({
    queryKey: ['payees'],
    queryFn: payeesApi.list,
  })

  const categories = useMemo(() => categoriesList ?? [], [categoriesList])
  const displayCategories = useMemo(
    () => allCategoriesList ?? categoriesList ?? [],
    [allCategoriesList, categoriesList],
  )
  const payees = useMemo(() => payeesList ?? [], [payeesList])

  const selectedPayee = useMemo(() => payees.find((p) => p.id === filterPayeeId), [payees, filterPayeeId])

  const categorySummary = useMemo(() => {
    if (categoryFilterIds.length > 1) {
      return t('transactions.filtersBar.nSelected', { count: categoryFilterIds.length })
    }
    if (categoryFilterIds.length === 1) {
      return displayCategories.find((c) => c.id === categoryFilterIds[0])?.name ?? ''
    }
    return ''
  }, [categoryFilterIds, displayCategories, t])

  const sortByLabel = useMemo(() => {
    switch (sortBy) {
      case 'name_asc':
        return t('rules.sortByNameAsc', 'Name (A to Z)')
      case 'name_desc':
        return t('rules.sortByNameDesc', 'Name (Z to A)')
      case 'category_asc':
        return t('rules.sortByCategoryAsc', 'Category (A to Z)')
      case 'category_desc':
        return t('rules.sortByCategoryDesc', 'Category (Z to A)')
      case 'execution':
      default:
        return t('rules.sortByExecution', 'Execution Order')
    }
  }, [sortBy, t])

  // Deterministic execution order: sorted by priority ASC, id ASC
  const fullOrderedRules = useMemo(() => {
    return [...(rulesList ?? [])].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.id.localeCompare(b.id)
    })
  }, [rulesList])

  // Available unique hashtags across all rules
  const availableRuleTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const rule of fullOrderedRules) {
      for (const a of rule.actions) {
        if (a.op === 'append_notes' && typeof a.value === 'string') {
          const matches = a.value.match(/#[\wÀ-ž-]+/g)
          if (matches) matches.forEach((t) => tagSet.add(t))
        }
      }
      const conds = flattenConditions(rule.conditions)
      for (const c of conds) {
        if (c.field === 'notes' && typeof c.value === 'string') {
          const matches = String(c.value).match(/#[\wÀ-ž-]+/g)
          if (matches) matches.forEach((t) => tagSet.add(t))
        }
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b))
  }, [fullOrderedRules])

  // Map each rule ID to its total execution sequence number (#1, #2, #3...)
  const executionOrderMap = useMemo(() => {
    const map = new Map<string, number>()
    fullOrderedRules.forEach((rule, index) => {
      map.set(rule.id, index + 1)
    })
    return map
  }, [fullOrderedRules])


  // Filtered rules based on search query, status, category, payee, tag, and ignore
  const filteredRules = useMemo(() => {
    let result = [...fullOrderedRules]

    if (statusFilter === 'active') {
      result = result.filter(r => r.is_active)
    } else if (statusFilter === 'inactive') {
      result = result.filter(r => !r.is_active)
    }

    if (categoryFilterIds.length > 0) {
      result = result.filter(r => {
        return r.actions.some(a => a.op === 'set_category' && (
          categoryFilterIds.includes(String(a.value)) ||
          categoryFilterIds.includes(findCategoryReference(displayCategories, a.value)?.id ?? '')
        ))
      })
    }

    if (filterPayeeId) {
      result = result.filter(r => {
        if (r.actions.some(a => a.op === 'set_payee' && a.value === filterPayeeId)) return true
        const conds = flattenConditions(r.conditions)
        if (conds.some(c => c.field === 'payee_id' && c.value === filterPayeeId)) return true
        if (selectedPayee && conds.some(c => c.field === 'payee' && String(c.value).toLowerCase() === selectedPayee.name.toLowerCase())) return true
        return false
      })
    }

    if (filterTag) {
      const normalizedTag = filterTag.toLowerCase()
      result = result.filter(r => {
        if (r.actions.some(a => a.op === 'append_notes' && String(a.value).toLowerCase().includes(normalizedTag))) return true
        const conds = flattenConditions(r.conditions)
        if (conds.some(c => c.field === 'notes' && String(c.value).toLowerCase().includes(normalizedTag))) return true
        return false
      })
    }

    if (filterIgnore) {
      result = result.filter(r => r.actions.some(a => a.op === 'ignore'))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(rule => {
        if (rule.name.toLowerCase().includes(q)) return true
        
        const conds = flattenConditions(rule.conditions)
        for (const c of conds) {
          if (String(c.value ?? '').toLowerCase().includes(q)) return true
          if (String(c.field ?? '').toLowerCase().includes(q)) return true
        }

        for (const a of rule.actions) {
          if (a.op === 'set_category') {
            const cat = findCategoryReference(displayCategories, a.value)
            if (cat?.name.toLowerCase().includes(q)) return true
          }
          if (a.op === 'set_payee') {
            const p = payees.find(p => p.id === a.value)
            if (p?.name.toLowerCase().includes(q)) return true
          }
          if (a.op === 'set_description' || a.op === 'append_notes') {
            if (String(a.value ?? '').toLowerCase().includes(q)) return true
          }
        }

        return false
      })
    }

    if (sortBy === 'name_asc') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'name_desc') {
      result.sort((a, b) => b.name.localeCompare(a.name))
    } else if (sortBy === 'category_asc') {
      result.sort((a, b) => {
        const aCat = a.actions?.find(act => act.op === 'set_category')
          ? (findCategoryReference(categories, a.actions.find(act => act.op === 'set_category')!.value)?.name ?? '')
          : ''
        const bCat = b.actions?.find(act => act.op === 'set_category')
          ? (findCategoryReference(categories, b.actions.find(act => act.op === 'set_category')!.value)?.name ?? '')
          : ''
        if (!aCat && bCat) return 1
        if (aCat && !bCat) return -1
        const cmp = aCat.localeCompare(bCat)
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name)
      })
    } else if (sortBy === 'category_desc') {
      result.sort((a, b) => {
        const aCat = a.actions?.find(act => act.op === 'set_category')
          ? (findCategoryReference(categories, a.actions.find(act => act.op === 'set_category')!.value)?.name ?? '')
          : ''
        const bCat = b.actions?.find(act => act.op === 'set_category')
          ? (findCategoryReference(categories, b.actions.find(act => act.op === 'set_category')!.value)?.name ?? '')
          : ''
        if (!aCat && bCat) return 1
        if (aCat && !bCat) return -1
        const cmp = bCat.localeCompare(aCat)
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name)
      })
    }

    return result
  }, [fullOrderedRules, statusFilter, categoryFilterIds, filterPayeeId, filterTag, filterIgnore, searchQuery, sortBy, displayCategories, categories, payees, selectedPayee])

  // Counts
  const counts = useMemo(() => {
    const total = fullOrderedRules.length
    const active = fullOrderedRules.filter(r => r.is_active).length
    const inactive = total - active
    return { total, active, inactive }
  }, [fullOrderedRules])

  const activeFiltersCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (categoryFilterIds.length > 0 ? 1 : 0) +
    (filterPayeeId ? 1 : 0) +
    (filterTag ? 1 : 0) +
    (filterIgnore ? 1 : 0)

  const hasAnyFilter = searchQuery.trim() !== '' || activeFiltersCount > 0
  const isFilteringActive = hasAnyFilter
  const canReorder = canWrite && !isFilteringActive && sortBy === 'execution'

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Omit<Rule, 'id' | 'user_id'>) => rulesApi.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      queryClient.invalidateQueries({ queryKey: ['rule-packs'] })
      setDialogOpen(false)
      const applied = result.applied_count ?? 0
      if (applied > 0) {
        invalidateFinancialQueries(queryClient)
        queryClient.invalidateQueries({ queryKey: ['payees'] })
        toast.success(t('rules.createdAndApplied', { count: applied }))
      } else {
        toast.success(t('rules.created'))
      }
    },
    onError: (error: unknown) => {
      const err = error as { response?: { status?: number } }
      if (err?.response?.status === 409) {
        toast.error(t('rules.duplicateName'))
      } else {
        toast.error(t('common.error'))
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Rule> & { id: string }) => rulesApi.update(id, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      queryClient.invalidateQueries({ queryKey: ['rule-packs'] })
      setDialogOpen(false)
      setEditing(null)
      const applied = result.applied_count ?? 0
      if (applied > 0) {
        invalidateFinancialQueries(queryClient)
        queryClient.invalidateQueries({ queryKey: ['payees'] })
        toast.success(t('rules.updatedAndApplied', { count: applied }))
      } else {
        toast.success(t('rules.updated'))
      }
    },
    onError: (error: unknown) => {
      const err = error as { response?: { status?: number } }
      if (err?.response?.status === 409) {
        toast.error(t('rules.duplicateName'))
      } else {
        toast.error(t('common.error'))
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      queryClient.invalidateQueries({ queryKey: ['rule-packs'] })
      setDeletingRule(null)
      toast.success(t('rules.deleted'))
    },
    onError: (err: unknown) => {
      toast.error(extractApiError(err, t('common.error')))
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (ruleIds: string[]) => rulesApi.reorder(ruleIds),
    onMutate: async (newIds) => {
      await queryClient.cancelQueries({ queryKey: ['rules'] })
      const previousRules = queryClient.getQueryData<Rule[]>(['rules'])
      if (previousRules) {
        const idMap = new Map(previousRules.map(r => [r.id, r]))
        const optimistic = newIds.map((id, idx) => ({
          ...idMap.get(id)!,
          priority: idx * 10,
        }))
        queryClient.setQueryData(['rules'], optimistic)
      }
      return { previousRules }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['rules'], data)
    },
    onError: (_err, _newIds, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(['rules'], context.previousRules)
      }
      toast.error(t('common.error'))
    },
  })

  const applyAllMutation = useMutation({
    mutationFn: () => rulesApi.applyAll(),
    onSuccess: (data) => {
      invalidateFinancialQueries(queryClient)
      queryClient.invalidateQueries({ queryKey: ['payees'] })
      toast.success(t('rules.applied', { count: data.applied }))
    },
    onError: () => toast.error(t('common.error')),
  })

  const exportMutation = useMutation({
    mutationFn: () => rulesApi.exportFile(),
    onSuccess: () => toast.success(t('rules.exported')),
    onError: () => toast.error(t('common.error')),
  })

  const importMutation = useMutation({
    mutationFn: (payload: RuleExportPayload) =>
      rulesApi.importFile(payload, true, createMissingCategories),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      queryClient.invalidateQueries({ queryKey: ['rule-packs'] })
      if ((data.categories_created ?? 0) > 0) {
        queryClient.invalidateQueries({ queryKey: ['categories'] })
      }
      setImportDialogOpen(false)
      setPendingImport(null)
      setPendingImportName('')
      toast.success(t('rules.imported', { imported: data.imported, skipped: data.skipped }))
    },
    onError: () => toast.error(t('common.error')),
  })

  async function handleImportFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as RuleExportPayload
      if (parsed.format !== 'securo-categorization-rules' || !Array.isArray(parsed.rules)) {
        toast.error(t('rules.invalidImportFile'))
        return
      }
      setPendingImport(parsed)
      setPendingImportName(file.name)
      setImportDialogOpen(true)
    } catch {
      toast.error(t('rules.invalidImportFile'))
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const importAnalysis = useMemo<ImportPreAnalysis | null>(() => {
    if (!pendingImport) return null

    const categoryNames = new Set(displayCategories.map(c => c.name.toLowerCase()))
    const categoryIds = new Set(displayCategories.map(c => String(c.id)))
    const accountIds = new Set((accountsList ?? []).map(a => String(a.id)))
    const payeeIds = new Set(payees.map(p => String(p.id)))

    const seenNames = new Set<string>()
    const items: ImportPreAnalysisItem[] = []
    const categoriesToCreate = new Set<string>()
    let readyCount = 0
    let skippedCount = 0

    for (const rule of pendingImport.rules) {
      if (seenNames.has(rule.name)) {
        skippedCount++
        items.push({
          name: rule.name,
          valid: false,
          reason: t('rules.importReasonDuplicateName', 'Duplicate name in file'),
        })
        continue
      }
      seenNames.add(rule.name)

      let skipReason: string | null = null

      const leafConditions = flattenConditions(rule.conditions)
      for (const c of leafConditions) {
        if (c.field === 'account_id') {
          const val = String(c.value ?? '')
          if (!accountIds.has(val)) {
            skipReason = t('rules.importReasonMissingAccount', 'Referenced account not found')
            break
          }
        } else if (c.field === 'payee_id') {
          const val = String(c.value ?? '')
          if (!payeeIds.has(val)) {
            skipReason = t('rules.importReasonMissingPayee', 'Referenced payee not found')
            break
          }
        }
      }

      if (!skipReason) {
        for (const a of rule.actions || []) {
          if (a.op === 'set_category') {
            const val = String(a.value ?? '').trim()
            const exists = categoryNames.has(val.toLowerCase()) || categoryIds.has(val)
            if (!exists) {
              if (createMissingCategories && val) {
                categoriesToCreate.add(val)
              } else {
                skipReason = t('rules.importReasonMissingCategory', { category: val })
                break
              }
            }
          } else if (a.op === 'set_payee') {
            const val = String(a.value ?? '')
            if (!payeeIds.has(val)) {
              skipReason = t('rules.importReasonMissingPayee', 'Referenced payee not found')
              break
            }
          }
        }
      }

      if (skipReason) {
        skippedCount++
        items.push({
          name: rule.name,
          valid: false,
          reason: skipReason,
        })
      } else {
        readyCount++
        items.push({
          name: rule.name,
          valid: true,
        })
      }
    }

    return {
      total: pendingImport.rules.length,
      readyCount,
      skippedCount,
      categoriesToCreate: Array.from(categoriesToCreate),
      items,
    }
  }, [pendingImport, createMissingCategories, displayCategories, accountsList, payees, t])

  function handleDrop(sourceId: string, targetId: string, position: 'before' | 'after') {
    if (sourceId === targetId) return
    const currentList = [...fullOrderedRules]
    const fromIdx = currentList.findIndex(r => r.id === sourceId)
    if (fromIdx === -1) return
    const [moved] = currentList.splice(fromIdx, 1)

    let toIdx = currentList.findIndex(r => r.id === targetId)
    if (toIdx === -1) return
    if (position === 'after') {
      toIdx += 1
    }
    currentList.splice(toIdx, 0, moved)

    const newIds = currentList.map(r => r.id)
    reorderMutation.mutate(newIds)
  }

  function handleDuplicate(rule: Rule) {
    const baseName = rule.name.replace(/\s*\(Copy(\s*\d+)?\)$/, '')
    let copyName = `${baseName} (Copy)`
    const existingNames = new Set(rulesList?.map(r => r.name) ?? [])
    let counter = 1
    while (existingNames.has(copyName)) {
      counter++
      copyName = `${baseName} (Copy ${counter})`
    }

    createMutation.mutate({
      name: copyName,
      conditions_op: rule.conditions_op,
      conditions: rule.conditions,
      actions: rule.actions,
      priority: rule.priority + 1,
      is_active: rule.is_active,
      apply_to_existing: false,
    })
  }

  function handleToggleActive(rule: Rule, e: React.MouseEvent | React.ChangeEvent) {
    e.stopPropagation()
    updateMutation.mutate({
      id: rule.id,
      is_active: !rule.is_active,
    })
  }

  function clearAllFilters() {
    setSearchQuery('')
    setStatusFilter('all')
    setCategoryFilterIds([])
    setFilterPayeeId('')
    setFilterTag('')
    setFilterIgnore(false)
    setSortBy('execution')
  }

  return (
    <div>
      {/* Top Page Header with Action Buttons */}
      <PageHeader
        section={t('rules.section')}
        title={t('nav.rules')}
        action={
          canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleImportFile(file)
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending}
              >
                <Download size={13} />
                <span className="hidden sm:inline">{t('rules.export')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => importInputRef.current?.click()}
                disabled={importMutation.isPending}
              >
                <Upload size={13} />
                <span className="hidden sm:inline">{t('rules.import')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setPacksDialogOpen(true)}
              >
                <Package size={13} />
                <span className="hidden sm:inline">{t('rules.packs')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => {
                  if (window.confirm(t('rules.confirmResetAndReapplyAll', 'Reset matching transaction categories, notes, and rule-managed descriptions, then reapply all active rules?'))) {
                    applyAllMutation.mutate()
                  }
                }}
                disabled={applyAllMutation.isPending}
              >
                <RefreshCw size={13} />
                <span className="hidden sm:inline">{t('rules.resetAndReapplyAll', 'Reset and reapply')}</span>
              </Button>
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={openCreate}>
                <Plus size={14} /> <span>{t('rules.add')}</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Standalone Filters Bar */}
      <div
        className={cn(
          'group/filterbar rounded-xl border border-border bg-card shadow-sm transition-colors mb-4',
          'focus-within:border-primary/40 focus-within:ring-[3px] focus-within:ring-primary/10',
        )}
      >
        {/* Top row: search input + controls */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* Search Input */}
          <div className="relative flex min-w-0 flex-1 items-center gap-1 px-2.5 py-1 min-h-9">
            <Search size={15} className="pointer-events-none shrink-0 text-muted-foreground/70 mr-1.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('rules.searchPlaceholder', 'Search rules by name, conditions, or actions...')}
              className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 outline-none border-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground/70 hover:text-foreground p-0.5 rounded"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Right-side controls */}
          <div className="ml-auto flex shrink-0 items-center gap-1 pl-1">
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="hidden h-7 items-center rounded-md px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
              >
                {t('transactions.clearFilters', 'Clear filters')}
              </button>
            )}

            {/* Filters Dropdown */}
            <DropdownMenu open={filterMenuOpen} onOpenChange={setFilterMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('transactions.filtersBar.filters', 'Filters')}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-card px-2.5 text-[12px] font-medium text-muted-foreground transition-colors',
                    'hover:bg-muted hover:text-foreground',
                    filterMenuOpen && 'bg-muted text-foreground',
                    (statusFilter !== 'all' || categoryFilterIds.length > 0) && 'border-primary/30 text-primary hover:text-primary',
                  )}
                >
                  <ListFilter size={13} />
                  <span className="hidden sm:inline">
                    {t('transactions.filtersBar.filters', 'Filters')}
                  </span>
                  {(statusFilter !== 'all' || categoryFilterIds.length > 0) && (
                    <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                      {(statusFilter !== 'all' ? 1 : 0) + (categoryFilterIds.length > 0 ? 1 : 0)}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={6}
                className="w-[min(18rem,calc(100vw-2rem))] p-1 sm:w-[240px]"
              >
                <DropdownMenuLabel className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {t('transactions.filtersBar.filterBy', 'Filter by')}
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  {/* Status Submenu */}
                  <DropdownMenuSub open={statusSubOpen} onOpenChange={setStatusSubOpen}>
                    <DropdownMenuSubTrigger className="gap-2 text-[13px]">
                      <Activity size={14} className="text-muted-foreground" />
                      <span className="flex-1">{t('rules.status', 'Status')}</span>
                      {statusFilter !== 'all' && (
                        <span className="max-w-[90px] truncate text-[11px] text-muted-foreground">
                          {statusFilter === 'active' ? t('rules.filterActive', 'Active') : t('rules.filterInactive', 'Inactive')}
                        </span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent sideOffset={8} className="w-[190px] p-1 text-xs">
                        <DropdownMenuItem
                          onSelect={() => {
                            setStatusFilter('all')
                            setFilterMenuOpen(false)
                          }}
                          className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', statusFilter === 'all' && 'bg-primary/5')}
                        >
                          <span className="flex-1">{t('rules.filterAll', 'All')}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">({counts.total})</span>
                          {statusFilter === 'all' && <Check size={13} className="text-primary" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setStatusFilter('active')
                            setFilterMenuOpen(false)
                          }}
                          className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', statusFilter === 'active' && 'bg-primary/5')}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="flex-1">{t('rules.filterActive', 'Active')}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">({counts.active})</span>
                          {statusFilter === 'active' && <Check size={13} className="text-primary" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setStatusFilter('inactive')
                            setFilterMenuOpen(false)
                          }}
                          className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', statusFilter === 'inactive' && 'bg-primary/5')}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                          <span className="flex-1">{t('rules.filterInactive', 'Inactive')}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">({counts.inactive})</span>
                          {statusFilter === 'inactive' && <Check size={13} className="text-primary" />}
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  {/* Category Submenu */}
                  {displayCategories.length > 0 && (
                    <DropdownMenuSub
                      open={categorySubOpen}
                      onOpenChange={(open) => {
                        if (!open && keepCategorySubOpenRef.current) {
                          keepCategorySubOpenRef.current = false
                          return
                        }
                        setCategorySubOpen(open)
                      }}
                    >
                      <DropdownMenuSubTrigger className="gap-2 text-[13px]">
                        <Tag size={14} className="text-muted-foreground" />
                        <span className="flex-1">{t('transactions.category', 'Category')}</span>
                        {categorySummary && (
                          <span className="max-w-[90px] truncate text-[11px] text-muted-foreground">
                            {categorySummary}
                          </span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent sideOffset={8} className="max-h-[320px] w-[240px] overflow-y-auto p-1">
                          <CategoryFilterContent
                            categoryIds={categoryFilterIds}
                            onCategoryIdsChange={setCategoryFilterIds}
                            allowUncategorized={false}
                            categories={displayCategories}
                            groups={categoryGroupsList ?? []}
                            onKeepOpen={() => {
                              keepCategorySubOpenRef.current = true
                            }}
                          />
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  )}

                  {/* Payee Submenu */}
                  {payees.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2 text-[13px]">
                        <Store size={14} className="text-muted-foreground" />
                        <span className="flex-1">{t('payees.payee', 'Payee')}</span>
                        {selectedPayee && (
                          <span className="max-w-[90px] truncate text-[11px] text-muted-foreground">
                            {selectedPayee.name}
                          </span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent sideOffset={8} className="max-h-[320px] w-[220px] overflow-y-auto p-1">
                          <DropdownMenuItem
                            onSelect={() => {
                              setFilterPayeeId('')
                              setFilterMenuOpen(false)
                            }}
                            className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', !filterPayeeId && 'bg-primary/5')}
                          >
                            <span className="min-w-0 flex-1 truncate text-left">{t('transactions.all', 'All')}</span>
                            {!filterPayeeId && <Check size={13} className="text-primary" />}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          {payees.map((p) => (
                            <DropdownMenuItem
                              key={p.id}
                              onSelect={() => {
                                setFilterPayeeId(filterPayeeId === p.id ? '' : p.id)
                                setFilterMenuOpen(false)
                              }}
                              className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', filterPayeeId === p.id && 'bg-primary/5')}
                            >
                              <span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
                              {filterPayeeId === p.id && <Check size={13} className="text-primary" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  )}

                  {/* Tags Submenu */}
                  {availableRuleTags.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="gap-2 text-[13px]">
                        <Hash size={14} className="text-muted-foreground" />
                        <span className="flex-1">{t('transactions.tags', 'Tags')}</span>
                        {filterTag && (
                          <span className="max-w-[90px] truncate text-[11px] text-muted-foreground">
                            {filterTag}
                          </span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent sideOffset={8} className="max-h-[320px] w-[200px] overflow-y-auto p-1">
                          <DropdownMenuItem
                            onSelect={() => {
                              setFilterTag('')
                              setFilterMenuOpen(false)
                            }}
                            className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', !filterTag && 'bg-primary/5')}
                          >
                            <span className="min-w-0 flex-1 truncate text-left">{t('transactions.all', 'All')}</span>
                            {!filterTag && <Check size={13} className="text-primary" />}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          {availableRuleTags.map((tag) => (
                            <DropdownMenuItem
                              key={tag}
                              onSelect={() => {
                                setFilterTag(filterTag === tag ? '' : tag)
                                setFilterMenuOpen(false)
                              }}
                              className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', filterTag === tag && 'bg-primary/5')}
                            >
                              <span className="min-w-0 flex-1 truncate text-left font-medium">{tag}</span>
                              {filterTag === tag && <Check size={13} className="text-primary" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  )}

                  {/* Ignore Transaction Checkbox Toggle */}
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      setFilterIgnore((v) => !v)
                    }}
                    className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', filterIgnore && 'bg-primary/5')}
                  >
                    <EyeClosed size={14} className="text-muted-foreground" />
                    <span className="flex-1">{t('rules.ignoreAction', 'Ignore transaction')}</span>
                    {filterIgnore && <Check size={13} className="text-primary" />}
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                {(statusFilter !== 'all' || categoryFilterIds.length > 0 || filterPayeeId || filterTag || filterIgnore) && (
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                      onSelect={clearAllFilters}
                      className="gap-2 rounded-sm px-2 py-1.5 text-[12px] text-muted-foreground"
                    >
                      <X size={12} />
                      <span>{t('transactions.clearFilters', 'Clear all filters')}</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('rules.sort', 'Sort')}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-card px-2.5 text-[12px] font-medium text-muted-foreground transition-colors',
                    'hover:bg-muted hover:text-foreground',
                    sortBy !== 'execution' && 'border-primary/30 text-primary hover:text-primary',
                  )}
                >
                  <ArrowUpDown size={13} />
                  <span className="hidden sm:inline">{sortByLabel}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-[190px] p-1 text-xs">
                <DropdownMenuLabel className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {t('rules.sortBy', 'Sort by')}
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onSelect={() => setSortBy('execution')}
                    className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', sortBy === 'execution' && 'bg-primary/5')}
                  >
                    <span className="flex-1">{t('rules.sortByExecution', 'Execution Order')}</span>
                    {sortBy === 'execution' && <Check size={13} className="text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setSortBy('name_asc')}
                    className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', sortBy === 'name_asc' && 'bg-primary/5')}
                  >
                    <span className="flex-1">{t('rules.sortByNameAsc', 'Name (A to Z)')}</span>
                    {sortBy === 'name_asc' && <Check size={13} className="text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setSortBy('name_desc')}
                    className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', sortBy === 'name_desc' && 'bg-primary/5')}
                  >
                    <span className="flex-1">{t('rules.sortByNameDesc', 'Name (Z to A)')}</span>
                    {sortBy === 'name_desc' && <Check size={13} className="text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setSortBy('category_asc')}
                    className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', sortBy === 'category_asc' && 'bg-primary/5')}
                  >
                    <span className="flex-1">{t('rules.sortByCategoryAsc', 'Category (A to Z)')}</span>
                    {sortBy === 'category_asc' && <Check size={13} className="text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setSortBy('category_desc')}
                    className={cn('gap-2 rounded-sm px-2 py-1.5 text-[13px]', sortBy === 'category_desc' && 'bg-primary/5')}
                  >
                    <span className="flex-1">{t('rules.sortByCategoryDesc', 'Category (Z to A)')}</span>
                    {sortBy === 'category_desc' && <Check size={13} className="text-primary" />}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(statusFilter !== 'all' || categoryFilterIds.length > 0 || filterPayeeId || filterTag || filterIgnore) && (
          <div className="flex flex-wrap items-center gap-1 border-t border-border/60 px-2 py-1.5">
            {statusFilter !== 'all' && (
              <FilterChip
                icon={<Activity size={12} />}
                label={t('rules.status', 'Status')}
                value={statusFilter === 'active' ? t('rules.filterActive', 'Active') : t('rules.filterInactive', 'Inactive')}
                onRemove={() => setStatusFilter('all')}
              />
            )}

            {categoryFilterIds.map((id) => {
              const cat = displayCategories.find((c) => c.id === id)
              if (!cat) return null
              return (
                <FilterChip
                  key={`cat-${id}`}
                  icon={<Tag size={12} />}
                  label={t('transactions.category', 'Category')}
                  value={cat.name}
                  tint={cat.color ?? undefined}
                  onRemove={() => setCategoryFilterIds((prev) => prev.filter((x) => x !== id))}
                />
              )
            })}

            {selectedPayee && (
              <FilterChip
                icon={<Store size={12} />}
                label={t('payees.payee', 'Payee')}
                value={selectedPayee.name}
                onRemove={() => setFilterPayeeId('')}
              />
            )}

            {filterTag && (
              <FilterChip
                icon={<Hash size={12} />}
                label={t('transactions.tags', 'Tag')}
                value={filterTag}
                onRemove={() => setFilterTag('')}
              />
            )}

            {filterIgnore && (
              <FilterChip
                icon={<EyeClosed size={12} />}
                label={t('rules.fieldAction', 'Action')}
                value={t('rules.ignoreAction', 'Ignore transaction')}
                onRemove={() => setFilterIgnore(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Rules List Container */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-4">
        {fullOrderedRules.length > 0 ? (
          filteredRules.length > 0 ? (
            <div>
              <div className="divide-y divide-border">
                {filteredRules.map((rule, index) => {
                  const executionOrder = executionOrderMap.get(rule.id) ?? index + 1
                  const isDragging = draggedRuleId === rule.id
                  const isOverTop = dragOverTarget?.id === rule.id && dragOverTarget.pos === 'before'
                  const isOverBottom = dragOverTarget?.id === rule.id && dragOverTarget.pos === 'after'

                  return (
                    <div
                      key={rule.id}
                      onDragOver={(e) => {
                        if (!canReorder || !draggedRuleId || draggedRuleId === rule.id) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        const rect = e.currentTarget.getBoundingClientRect()
                        const pos = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
                        if (!dragOverTarget || dragOverTarget.id !== rule.id || dragOverTarget.pos !== pos) {
                          setDragOverTarget({ id: rule.id, pos })
                        }
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          if (dragOverTarget?.id === rule.id) setDragOverTarget(null)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (draggedRuleId && dragOverTarget && draggedRuleId !== rule.id) {
                          handleDrop(draggedRuleId, dragOverTarget.id, dragOverTarget.pos)
                        }
                        setDraggedRuleId(null)
                        setDragOverTarget(null)
                      }}
                      className={cn(
                        'relative px-4 sm:px-5 py-3.5 hover:bg-muted/40 transition-colors group',
                        canWrite && 'cursor-pointer',
                        !rule.is_active && 'opacity-65 bg-muted/10',
                        isDragging && 'opacity-30 bg-muted/70 scale-[0.99]',
                      )}
                      onClick={() => {
                        if (canWrite) openEdit(rule)
                      }}
                    >
                      {/* Glowing insertion line */}
                      {isOverTop && (
                        <div className="absolute -top-[1.5px] left-2 right-2 h-[3px] bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.8)] z-30 pointer-events-none" />
                      )}
                      {isOverBottom && (
                        <div className="absolute -bottom-[1.5px] left-2 right-2 h-[3px] bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.8)] z-30 pointer-events-none" />
                      )}

                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Drag Handle & Sequence Badge */}
                        <div className="flex items-center gap-2 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                          {canReorder ? (
                            <div
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', rule.id)
                                setDraggedRuleId(rule.id)
                              }}
                              onDragEnd={() => {
                                setDraggedRuleId(null)
                                setDragOverTarget(null)
                              }}
                              className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground p-0.5 rounded transition-colors"
                              title="Drag to reorder rule execution"
                            >
                              <GripVertical size={16} />
                            </div>
                          ) : null}
                          <span
                            className={cn(
                              'text-xs font-bold px-2 py-0.5 rounded-md min-w-8 text-center tabular-nums border shadow-2xs',
                              rule.is_active
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-muted text-muted-foreground border-border',
                            )}
                            title={`Execution priority #${executionOrder}`}
                          >
                            #{executionOrder}
                          </span>
                        </div>

                        {/* Rule Details */}
                        <div className="flex-1 min-w-0">
                          {/* Title Row */}
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <p className="text-sm font-semibold text-foreground truncate">{rule.name}</p>
                            
                            {!rule.is_active ? (
                              <span className="text-[10px] font-semibold bg-muted text-muted-foreground border border-border px-1.5 py-0.2 rounded-full">
                                {t('rules.inactive', 'inactive')}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded-full">
                                {t('rules.filterActive', 'active')}
                              </span>
                            )}
                          </div>

                          {/* Conditions & Actions */}
                          <div className="space-y-1 text-xs">
                            {/* IF Conditions */}
                            <div className="flex items-baseline gap-2">
                              <span className="font-mono font-bold text-[10px] tracking-wider uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                IF
                              </span>
                              <span className="text-muted-foreground font-mono truncate">
                                {conditionSummary(rule.conditions, rule.conditions_op, t, payees)}
                              </span>
                            </div>

                            {/* THEN Actions */}
                            <div className="flex items-baseline gap-2">
                              <span className="font-mono font-bold text-[10px] tracking-wider uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                                THEN
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate">
                                {actionSummary(rule.actions, displayCategories, payees, t)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions Right Side */}
                        {canWrite && (
                          <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                            {/* Toggle Active Button */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleActive(rule, e)}
                              className={cn(
                                'p-1.5 rounded-lg border transition-all',
                                rule.is_active
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20'
                                  : 'bg-muted border-border text-muted-foreground hover:text-foreground',
                              )}
                              title={rule.is_active ? 'Click to disable rule' : 'Click to enable rule'}
                            >
                              <span className="flex items-center gap-1">
                                <span className={cn('w-2 h-2 rounded-full', rule.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                              </span>
                            </button>

                            {/* Duplicate Button */}
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              onClick={() => handleDuplicate(rule)}
                              title={t('rules.duplicate', 'Duplicate rule')}
                            >
                              <Copy size={14} />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                              onClick={() => setDeletingRule(rule)}
                              disabled={deleteMutation.isPending}
                              title={t('common.delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Table / List Footer */}
              <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between bg-muted/5">
                <span className="tabular-nums font-medium">
                  {isFilteringActive
                    ? t('rules.filteredCount', { filtered: filteredRules.length, total: counts.total })
                    : `${counts.total} ${counts.total === 1 ? 'rule' : 'rules'}`}
                </span>
                <span className="text-[11px] text-muted-foreground/80">
                  {counts.active} {t('rules.filterActive', 'active')} · {counts.inactive} {t('rules.filterInactive', 'inactive')}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-12 px-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground font-medium">
                {searchQuery
                  ? t('rules.noRulesMatching', { query: searchQuery })
                  : t('rules.empty')}
              </p>
              {isFilteringActive && (
                <Button variant="outline" size="sm" onClick={clearAllFilters} className="text-xs">
                  {t('rules.clearFilters', 'Clear filters')}
                </Button>
              )}
            </div>
          )
        ) : (
          <div className="py-12 px-4 text-center space-y-3">
            <p className="text-sm text-muted-foreground">{t('rules.empty')}</p>
            {canWrite && (
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <Plus size={14} /> {t('rules.add')}
              </Button>
            )}
          </div>
        )}
      </div>

      <DeleteConfirmationDialog
        open={!!deletingRule}
        title={t('rules.confirmDeleteTitle')}
        description={t('rules.confirmDeleteDescription', { name: deletingRule?.name })}
        isPending={deleteMutation.isPending}
        onClose={() => setDeletingRule(null)}
        onConfirm={() => deletingRule && deleteMutation.mutate(deletingRule.id)}
      />

      <RulePacksDialog
        open={packsDialogOpen}
        onClose={() => setPacksDialogOpen(false)}
      />

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Upload size={18} className="text-primary" />
              <span>{t('rules.importConfirmTitle')}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5 text-sm">
            <p className="text-xs text-muted-foreground">
              {t('rules.importConfirmDescription', { count: pendingImport?.rules.length ?? 0, file: pendingImportName })}
            </p>

            {/* Option: Create missing categories */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                id="import-create-missing-categories"
                checked={createMissingCategories}
                onChange={(e) => setCreateMissingCategories(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <div className="space-y-0.5 flex-1 min-w-0">
                <Label
                  htmlFor="import-create-missing-categories"
                  className="text-xs font-semibold text-foreground cursor-pointer block"
                >
                  {t('rules.createMissingCategoriesLabel', 'Create missing categories')}
                </Label>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {t('rules.createMissingCategoriesHint', 'Categories needed by imported rules will be created automatically')}
                </p>
              </div>
            </div>

            {/* Pre-Import Analysis Cards */}
            {importAnalysis && (
              <div className="space-y-2.5">
                {/* Ready to Import Card */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                    {t('rules.importReadyCount', { count: importAnalysis.readyCount })}
                  </span>
                  <span className="text-muted-foreground font-semibold tabular-nums">{importAnalysis.readyCount}</span>
                </div>

                {/* Categories to Create Card with Scrollable Chips */}
                {createMissingCategories && importAnalysis.categoriesToCreate.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground flex items-center gap-2">
                        <Package size={14} className="text-muted-foreground" />
                        {t('rules.categoriesToCreate', { count: importAnalysis.categoriesToCreate.length })}
                      </span>
                      <span className="text-muted-foreground font-semibold tabular-nums">{importAnalysis.categoriesToCreate.length}</span>
                    </div>
                    <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1.5 pt-0.5">
                      {importAnalysis.categoriesToCreate.map((catName, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-background border border-border text-foreground"
                        >
                          {catName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skipped Rules Card */}
                {importAnalysis.skippedCount > 0 && (
                  <div className="rounded-lg bg-muted/40 border border-border text-xs overflow-hidden">
                    <div className="flex items-center justify-between p-2.5">
                      <span className="font-medium text-foreground flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                        {t('rules.importSkippedCount', { count: importAnalysis.skippedCount })}
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold tabular-nums">{importAnalysis.skippedCount}</span>
                    </div>

                    <div className="px-2.5 pb-2.5 pt-0 space-y-1.5 border-t border-border max-h-28 overflow-y-auto">
                      {importAnalysis.items.filter(i => !i.valid).map((item, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-2 text-[11px] pt-1.5">
                          <span className="font-medium text-foreground truncate">{item.name}</span>
                          <span className="text-muted-foreground shrink-0 text-[10px]">{item.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
              {t('rules.importOverwriteWarning')}
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-3.5 border-t border-border bg-muted/20 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false)
                setPendingImport(null)
                setPendingImportName('')
              }}
              disabled={importMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingImport) importMutation.mutate(pendingImport)
              }}
              disabled={!pendingImport || importMutation.isPending || (importAnalysis?.readyCount ?? 0) === 0}
            >
              {importMutation.isPending ? (
                <RefreshCw size={14} className="animate-spin mr-1.5" />
              ) : null}
              {t('rules.confirmOverwriteImport')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RuleDialog
        key={dialogInstance}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        rule={editing}
        categories={categories}
        categoryGroups={categoryGroupsList ?? []}
        currentCategories={allCategoriesList ?? []}
        accounts={accountsList ?? []}
        payees={payees}
        onSave={(data) => {
          if (editing) {
            updateMutation.mutate({ id: editing.id, ...data })
          } else {
            createMutation.mutate(data as Omit<Rule, 'id' | 'user_id'>)
          }
        }}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}

function RulePacksDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createMissingCategories, setCreateMissingCategories] = useState(true)

  const { data: rulePacks } = useQuery({
    queryKey: ['rule-packs'],
    queryFn: rulesApi.packs,
    enabled: open,
  })

  const installPackMutation = useMutation({
    mutationFn: (code: string) => rulesApi.installPack(code, createMissingCategories),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      queryClient.invalidateQueries({ queryKey: ['rule-packs'] })
      if (data.categories_created > 0) {
        queryClient.invalidateQueries({ queryKey: ['categories'] })
      }
      if (data.installed === 0) {
        if (data.unresolved > 0) {
          toast.error(t('rules.packMissingCategories'))
        } else {
          toast.info(t('rules.packAlreadyInstalled'))
        }
      } else if (data.categories_created > 0) {
        toast.success(
          t('rules.packInstalledWithCategories', {
            rules: data.installed,
            categories: data.categories_created,
          }),
        )
      } else {
        toast.success(t('rules.packInstalled', { count: data.installed }))
      }
    },
    onError: () => toast.error(t('common.error')),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('rules.packs')}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            id="create-missing-categories"
            checked={createMissingCategories}
            onChange={(e) => setCreateMissingCategories(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary"
          />
          <Label
            htmlFor="create-missing-categories"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            {t('rules.createMissingCategories')}
          </Label>
        </div>
        <div className="space-y-2">
          {rulePacks?.map((pack) => (
            <div
              key={pack.code}
              className="flex items-center gap-3 p-3 rounded-lg border border-border"
            >
              <span className="text-2xl">{pack.flag}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{pack.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t('rules.packRuleCount', { count: pack.rule_count })}
                </p>
              </div>
              {pack.installed ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <Check size={14} />
                  {t('rules.installed')}
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => installPackMutation.mutate(pack.code)}
                  disabled={installPackMutation.isPending}
                >
                  <Package size={11} />
                  {t('rules.installPack')}
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
