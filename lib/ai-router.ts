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
  ]
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

async function callModel(model: string, messages: AIMessage[]): Promise<string> {
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
    response_format: { type: 'json_object' },
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
  const chain = MODEL_CHAINS[task]
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS
  const startTime = Date.now()

  let lastError: Error = new Error('No models available')

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i]
    const isFallback = i > 0

    try {
      console.log(`[ai-router] calling model: ${model} (index ${i})`)
      const result = await queue.add(
        () => callWithTimeout(callModel(model, messages), timeout),
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
