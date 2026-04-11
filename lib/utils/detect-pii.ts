/**
 * PII detection utility — pure function, Node-compatible, no browser APIs.
 * Detects phone numbers, Chinese ID cards, and address keywords.
 */

export type PIIType = 'phone' | 'id_card' | 'address'

export interface PIIDetectionResult {
  detected: boolean
  types: PIIType[]
}

const PHONE_REGEX = /1[3-9]\d{9}/g
const ID_CARD_REGEX = /\d{17}[\dX]/gi
const ADDRESS_REGEX = /(省|市|区|街道|路\d+号)/g

export function detectPII(text: string): PIIDetectionResult {
  const types: PIIType[] = []

  if (PHONE_REGEX.test(text)) {
    types.push('phone')
  }

  // Reset lastIndex after stateful regex use
  PHONE_REGEX.lastIndex = 0
  ID_CARD_REGEX.lastIndex = 0
  ADDRESS_REGEX.lastIndex = 0

  if (ID_CARD_REGEX.test(text)) {
    types.push('id_card')
  }

  ID_CARD_REGEX.lastIndex = 0
  ADDRESS_REGEX.lastIndex = 0

  if (ADDRESS_REGEX.test(text)) {
    types.push('address')
  }

  ADDRESS_REGEX.lastIndex = 0

  return {
    detected: types.length > 0,
    types,
  }
}
