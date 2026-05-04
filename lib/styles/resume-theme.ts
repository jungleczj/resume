// Cobalt design system — single source of truth for all resume color tokens.
// Used by ResumePreview (CSS hex), docx-generator (OOXML hex), and pdf-generator (pdf-lib rgb).

export const COBALT = {
  accent:     '#2563eb',
  textBright: '#0f172a',
  textMain:   '#334155',
  textMuted:  '#64748b',
  mutedLight: '#94a3b8',
  surface:    '#f8fafc',
  surfaceDark:'#f1f5f9',
  border:     '#e2e8f0',
} as const

// Hex without '#' for OOXML (docx) consumers
export const COBALT_HEX = {
  accent:     '2563eb',
  textBright: '0f172a',
  textMain:   '334155',
  textMuted:  '64748b',
  mutedLight: '94a3b8',
  surface:    'f8fafc',
  border:     'e2e8f0',
} as const

// Normalised 0–1 RGB tuples for pdf-lib consumers
export const COBALT_RGB = {
  accent:     [0.145, 0.388, 0.922] as [number, number, number],
  textBright: [0.059, 0.090, 0.165] as [number, number, number],
  textMain:   [0.204, 0.255, 0.341] as [number, number, number],
  textMuted:  [0.392, 0.455, 0.545] as [number, number, number],
  mutedLight: [0.580, 0.639, 0.722] as [number, number, number],
  surface:    [0.973, 0.980, 0.988] as [number, number, number],
  border:     [0.886, 0.910, 0.941] as [number, number, number],
} as const

// Achievement tier colours (shared across preview, DOCX, and PDF)
export const TIER_COLORS = {
  1: { hex: '10b981', css: '#10b981', rgb: [0.063, 0.725, 0.506] as [number, number, number] },
  2: { hex: 'f59e0b', css: '#f59e0b', rgb: [0.961, 0.620, 0.043] as [number, number, number] },
  3: { hex: 'f87171', css: '#f87171', rgb: [0.973, 0.443, 0.443] as [number, number, number] },
} as const
