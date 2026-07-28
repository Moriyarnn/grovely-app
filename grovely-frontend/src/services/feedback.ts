export type FeedbackCategory = 'bug' | 'feature-request' | 'greeting' | 'encouragement' | 'other'

export interface FeedbackConfig {
  endpoint: string
  publicKey: string
  keyId: string
}

export interface FeedbackFields {
  category: FeedbackCategory
  message: string
  email?: string
}

interface EncryptedFeedbackEnvelope {
  version: 'v1'
  category: FeedbackCategory
  keyId: string
  ephemeralPublicKey: string
  iv: string
  ciphertext: string
  website: ''
}

const PUBLIC_KEY_LENGTH = 87
const IV_LENGTH = 16
const INSECURE_CONTEXT_ERROR = 'Feedback needs a secure connection. Please open Grovely over HTTPS, then try again.'
const UNSUPPORTED_ENCRYPTION_ERROR = "Your browser can't send encrypted feedback. Try updating it or using another browser."
const ENCRYPTION_FAILED_ERROR = "We couldn't prepare your feedback to send. Please try again, or try another browser."
const RETRY_LATER_ERROR = "We couldn't send feedback right now. Please try again in a moment."

export function feedbackConfig(): FeedbackConfig | null {
  const endpoint = import.meta.env.VITE_FEEDBACK_ENDPOINT?.trim()
  const publicKey = import.meta.env.VITE_FEEDBACK_PUBLIC_KEY?.trim()
  const keyId = import.meta.env.VITE_FEEDBACK_PUBLIC_KEY_ID?.trim() || 'v1'

  if (!endpoint || !publicKey || publicKey.length !== PUBLIC_KEY_LENGTH) return null

  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:') return null
  } catch {
    return null
  }

  return { endpoint, publicKey, keyId }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): ArrayBuffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid feedback key')
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return bytes.buffer as ArrayBuffer
}

export async function encryptFeedback(
  fields: FeedbackFields,
  config: FeedbackConfig,
): Promise<EncryptedFeedbackEnvelope> {
  if (globalThis.isSecureContext === false) throw new Error(INSECURE_CONTEXT_ERROR)
  if (!globalThis.crypto?.subtle) throw new Error(UNSUPPORTED_ENCRYPTION_ERROR)

  const recipientPublicKey = await crypto.subtle.importKey(
    'raw',
    base64UrlToBytes(config.publicKey),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPublicKey },
    ephemeralKeyPair.privateKey,
    256,
  )
  const encryptionKey = await crypto.subtle.importKey('raw', sharedSecret, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify({
    message: fields.message,
    ...(fields.email ? { email: fields.email } : {}),
  }))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, plaintext))
  const ephemeralPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey))

  return {
    version: 'v1',
    category: fields.category,
    keyId: config.keyId,
    ephemeralPublicKey: bytesToBase64Url(ephemeralPublicKey),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(ciphertext),
    website: '',
  }
}

export async function submitFeedback(fields: FeedbackFields, config: FeedbackConfig): Promise<void> {
  let envelope: EncryptedFeedbackEnvelope
  try {
    envelope = await encryptFeedback(fields, config)
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : ''
    if (message === INSECURE_CONTEXT_ERROR || message === UNSUPPORTED_ENCRYPTION_ERROR) throw caught
    throw new Error(ENCRYPTION_FAILED_ERROR)
  }

  let response: Response
  try {
    response = await fetch(config.endpoint, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    })
  } catch {
    throw new Error(RETRY_LATER_ERROR)
  }

  if (!response.ok) {
    if (response.status === 400) throw new Error('Something went wrong with this feedback. Please try again.')
    if (response.status === 413) throw new Error('That message is a little too long. Try shortening it and sending again.')
    if (response.status >= 500) throw new Error('The feedback service is having trouble right now. Please try again later.')
    throw new Error(RETRY_LATER_ERROR)
  }
}

export const feedbackLimits = {
  message: 4000,
  email: 254,
  iv: IV_LENGTH,
}
