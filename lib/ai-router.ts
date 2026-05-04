import PQueue from 'p-queue'
import OpenAI from 'openai'
import { trackEvent } from './analytics'
import type { AIMessage, AITask } from './types/domain'

// Rate-limited queue (max 3 concurrent AI calls)
const queue = new PQueue({ concurrency: 3 })

// ── Model chain: DeepSeek → OpenAI GPT → Qwen → Claude ──────────────────────
//   Each task gets an ordered list of models to try.
//   The first model that succeeds is used; failures cascade down the chain.

const MODEL_CHAINS: Record<AITask, string[]> = {
  resume_beautify: [
    'qwen-long',
    'deepseek-chat',
    'gpt-4o-mini',
    'claude-sonnet-4-20250514'
  ],
  resume_structure_extract: [
    'qwen-long',
    'deepseek-chat',
    'gpt-4o-mini',
    'claude-sonnet-4-20250514'
  ],
  resume_achievement_beautify: [
    'qwen-turbo',
    'deepseek-chat',
    'gpt-4o-mini',
    'claude-haiku-4-5-20251001'
  ],
  jd_parse: [
    'qwen-turbo',
    'deepseek-chat',
    'gpt-4o-mini',
    'claude-haiku-4-5-20251001'
  ],
  achievement_extract: [
    'qwen-long',
    'deepseek-chat',
    'gpt-4o-mini',
    'claude-sonnet-4-20250514'
  ],
  achievement_match: [
    'qwen-turbo',
    'deepseek-chat',
    'gpt-4o-mini',
    'claude-haiku-4-5-20251001'
  ],
  resume_translate: [
    'qwen-turbo',
    'deepseek-chat',
    'claude-haiku-4-5-20251001'
  ],
  resume_profile_translate: [
    'qwen-turbo',
    'deepseek-chat',
    'claude-haiku-4-5-20251001'
  ],
  resume_summary_generate: [
    'qwen-long',
    'deepseek-chat',
    'gpt-4o-mini',
    'claude-sonnet-4-20250514'
  ]
}

// ── DB-driven model chain cache (60s TTL) ────────────────────────────────────
// ai_models 表存模型编号（id→name），model_configs 表存整数 ID 数组。
// 更新数据库后最多 60s 生效，无需重新部署。
// 降级顺序：DB → 上次成功的内存缓存 → 硬编码 MODEL_CHAINS
let _chainCache: Record<string, string[]> | null = null
let _chainCacheExpiry = 0

async function getModelChains(): Promise<Record<AITask, string[]>> {
  const now = Date.now()
  if (_chainCache && now < _chainCacheExpiry) {
    return _chainCache as Record<AITask, string[]>
  }
  try {
    const { createServiceClient } = await import('./supabase/service')
    const supabase = createServiceClient()

    // id → model name 映射
    const { data: models } = await supabase
      .from('ai_models')
      .select('id, name')
      .eq('is_enabled', true)
    if (!models?.length) throw new Error('no models')

    const idToName: Record<number, string> = {}
    for (const m of models) idToName[m.id as number] = m.name as string

    // 每个任务的模型 ID 顺序
    const { data: configs, error } = await supabase
      .from('model_configs')
      .select('task_key, model_chain')
      .eq('is_active', true)
    if (error || !configs?.length) throw new Error('no configs')

    const fromDB: Record<string, string[]> = {}
    for (const row of configs) {
      const ids: number[] = Array.isArray(row.model_chain) ? row.model_chain : []
      const names = ids.map((id: number) => idToName[id]).filter(Boolean) as string[]
      if (names.length) fromDB[row.task_key as string] = names
    }

    // DB 配置覆盖硬编码，未配置的任务保留硬编码值
    _chainCache = { ...MODEL_CHAINS, ...fromDB }
    _chainCacheExpiry = now + 60_000
    return _chainCache as Record<AITask, string[]>
  } catch {
    // DB 不可用时静默降级，保留上次缓存（如有）
  }
  return (_chainCache as Record<AITask, string[]>) ?? MODEL_CHAINS
}

const DEFAULT_TIMEOUT_MS = 60_000

// ── Provider clients ─────────────────────────────────────────────────────────

// DeepSeek — OpenAI-compatible endpoint
const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  baseURL: 'https://api.deepseek.com'
})

// OpenAI
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? ''
})

// Qianwen (Alibaba DashScope) — OpenAI-compatible endpoint
const qianwenClient = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY ?? '',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
})

// Claude via Anthropic native messages API wrapped with OpenAI SDK compat layer
const claudeClient = new OpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  baseURL: 'https://api.anthropic.com/v1',
  defaultHeaders: {
    'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
    'anthropic-version': '2023-06-01'
  }
})

// ── Provider routing ─────────────────────────────────────────────────────────

function getProviderForModel(model: string): 'deepseek' | 'openai' | 'qianwen' | 'claude' {
  if (model.startsWith('deepseek-')) return 'deepseek'
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return 'openai'
  if (model.startsWith('claude-')) return 'claude'
  return 'qianwen'
}

// Tasks that return plain text (not JSON)
const PLAIN_TEXT_TASKS = new Set<AITask>(['resume_summary_generate'])

async function callModel(model: string, messages: AIMessage[], task: AITask): Promise<string> {
  const provider = getProviderForModel(model)

  let client: OpenAI
  switch (provider) {
    case 'deepseek': client = deepseekClient; break
    case 'openai':   client = openaiClient;   break
    case 'claude':   client = claudeClient;   break
    default:         client = qianwenClient;  break
  }

  const response = await client.chat.completions.create({
    model,
    messages,
    ...(!PLAIN_TEXT_TASKS.has(task) ? { response_format: { type: 'json_object' } } : {}),
    ...(provider === 'claude' ? { max_tokens: 4096 } : {})
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error(`Empty response from ${model}`)
  return content
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function callAI(
  task: AITask,
  messages: AIMessage[],
  market: 'cn' | 'en',
  options: { timeout?: number } = {}
): Promise<string> {
  const chains = await getModelChains()
  const chain = chains[task] ?? MODEL_CHAINS[task]
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS
  const startTime = Date.now()

  let lastError: Error = new Error('No models available')

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i]
    const isFallback = i > 0

    try {
      console.log(`[ai-router] calling model: ${model} (index ${i})`)
      const result = await queue.add(
        () => callWithTimeout(callModel(model, messages, task), timeout),
        { throwOnTimeout: true }
      )

      await trackEvent('ai_call_completed', {
        task,
        model,
        market,
        latency_ms: Date.now() - startTime,
        is_fallback: isFallback,
        fallback_index: i
      })

      return result as string
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`[ai-router] model ${model} failed:`, lastError.message)

      await trackEvent('ai_model_fallback', {
        task,
        from_model: model,
        to_model: chain[i + 1] ?? 'none',
        reason: lastError.message,
        market,
        fallback_index: i
      })

      if (i < chain.length - 1) continue

      throw new Error(
        `All AI models failed for task "${task}". Last error: ${lastError.message}`
      )
    }
  }

  throw lastError
}

function callWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`AI call timeout after ${ms}ms`)), ms)
    )
  ])
}
