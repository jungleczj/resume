// Extract personal info (name, email, phone, location, linkedin) from raw resume text

export interface ResumePersonalInfo {
  name: string | null
  email: string | null
  phone: string | null
  location: string | null
  linkedin: string | null
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_REGEX = /(?:\+?86)?[-.\s]?1[3-9]\d[-.\s]?\d{4}[-.\s]?\d{4}|\+?1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
const LINKEDIN_REGEX = /(?:linkedin\.com\/in\/|linkedin\.com\/pub\/)[\w-]+/gi

export function extractPersonalInfo(rawText: string): ResumePersonalInfo {
  const info: ResumePersonalInfo = {
    name: null,
    email: null,
    phone: null,
    location: null,
    linkedin: null
  }

  if (!rawText) return info

  // Extract email
  const emails = rawText.match(EMAIL_REGEX)
  if (emails && emails.length > 0) {
    // Prefer .com/.cn emails, filter out common false positives
    info.email = emails.find(e => 
      e.includes('.com') || e.includes('.cn') || e.includes('.io')
    ) || emails[0]
  }

  // Extract phone
  const phones = rawText.match(PHONE_REGEX)
  if (phones && phones.length > 0) {
    info.phone = phones[0].replace(/\s+/g, ' ').trim()
  }

  // Extract LinkedIn
  const linkedins = rawText.match(LINKEDIN_REGEX)
  if (linkedins && linkedins.length > 0) {
    info.linkedin = linkedins[0]
  }

  // Extract name - usually first non-empty line or first line with uppercase letters
  const lines = rawText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length > 0) {
    const firstLine = lines[0]
    // Name pattern: 2-4 Chinese characters OR 2-4 capitalized English words
    const chineseName = firstLine.match(/^[\u4e00-\u9fa5]{2,4}$/)
    if (chineseName) {
      info.name = chineseName[0]
    } else {
      // Try to find English name pattern at the beginning
      const englishName = firstLine.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}/)
      if (englishName) {
        info.name = englishName[0]
      } else if (firstLine.length >= 2 && firstLine.length <= 30 && /^[A-Za-z\s]/.test(firstLine)) {
        // Fallback: first line that looks like a name (only letters and spaces)
        info.name = firstLine.split(/\s+/).slice(0, 4).join(' ')
      }
    }
  }

  // Extract location - common patterns after name
  const locationPatterns = [
    /([\u4e00-\u9fa5]{2,6}(?:市|省|区|县|州|省))/g,
    /(?:based\s+in|located\s+in|location)[:\s]*([A-Za-z\s,]+(?:City|State|Country))/gi,
    /(?:Shanghai|Beijing|Shenzhen|Guangzhou|Hangzhou|Chengdu|Boston|New York|San Francisco|Seattle|Los Angeles)/gi
  ]

  for (const pattern of locationPatterns) {
    const matches = rawText.match(pattern)
    if (matches && matches.length > 0) {
      info.location = matches[0].replace(/^(?:based\s+in|located\s+in|location)[:\s]*/i, '').trim()
      break
    }
  }

  return info
}
