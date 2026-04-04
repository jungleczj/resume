import PQueue from 'p-queue'
import OpenAI from 'openai'
import { trackEvent } from './analytics'
import type { AIMessage, AITask } from './types/domain'

// Rate-limited queue (max 3 concurrent AI calls)
const queue = new PQueue({ concurrency: 3 })

const MODEL_ROUTES: Record<AITask, { primary: string; fallback: string }> = {
  resume_beautify: {
    primary: 'qwen-long',
    fallback: 'claude-sonnet-4-20250514'
  },
  jd_parse: {
    primary: 'qwen-turbo',
    fallback: 'claude-haiku-4-5-20251001'
  },
  achievement_extract: {
    primary: 'qwen-long',
    fallback: 'claude-sonnet-4-20250514'
  },
  achievement_match: {
    primary: 'qwen-turbo',
    fallback: 'claude-haiku-4-5-20251001'
  }
}

const DEFAULT_TIMEOUT_MS = 30_000

// Qianwen client (OpenAI-compatible API)
const qianwenClient = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY!,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
})

// Claude client — uses Anthropic's OpenAI-compatible endpoint with correct auth
const claudeClient = new OpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: 'https://api.anthropic.com/v1',
  defaultHeaders: {
    'x-api-key': process.env.ANTHROPIC_API_KEY!,
    'anthropic-version': '2023-06-01'
  }
})

export async function callAI(
  task: AITask,
  messages: AIMessage[],
  market: 'cn' | 'en',
  options: { timeout?: number } = {}
): Promise<string> {
  const { primary, fallback } = MODEL_ROUTES[task]
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS
  const startTime = Date.now()

  try {
    const result = await queue.add(
      () => callWithTimeout(callQianwen(primary, messages), timeout),
      { throwOnTimeout: true }
    )

    await trackEvent('ai_call_completed', {
      task,
      model: primary,
      market,
      latency_ms: Date.now() - startTime,
      is_fallback: false
    })

    return result as string
  } catch (err) {
    const error = err as Error

    await trackEvent('ai_model_fallback', {
      task,
      from_model: primary,
      to_model: fallback,
      reason: error.message,
      market
    })

    const fallbackResult = await callWithTimeout(
      isClaudeModel(fallback)
        ? callClaude(fallback, messages)
        : callQianwen(fallback, messages),
      timeout
    )

    await trackEvent('ai_call_completed', {
      task,
      model: fallback,
      market,
      latency_ms: Date.now() - startTime,
      is_fallback: true
    })

    return fallbackResult
  }
}

async function callQianwen(
  model: string,
  messages: AIMessage[]
): Promise<string> {
  const response = await qianwenClient.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_object' }
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from Qianwen')
  return content
}

async function callClaude(
  model: string,
  messages: AIMessage[]
): Promise<string> {
  const response = await claudeClient.chat.completions.create({
    model,
    messages,
    max_tokens: 4096
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from Claude')
  return content
}

function isClaudeModel(model: string): boolean {
  return model.startsWith('claude-')
}

function callWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`AI call timeout after ${ms}ms`)), ms)
    )
  ])
}
