import { afterEach, describe, expect, it, vi } from 'vitest'

import { encryptFeedback, submitFeedback, type FeedbackConfig } from './feedback'

const config: FeedbackConfig = {
  endpoint: 'https://feedback.example.test/v1/feedback',
  publicKey: '',
  keyId: 'v1',
}

async function encryptionConfig(): Promise<FeedbackConfig> {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
  let binary = ''
  for (const byte of raw) binary += String.fromCharCode(byte)
  return { ...config, publicKey: btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('feedback encryption', () => {
  it('explains that feedback needs HTTPS when opened from an insecure origin', async () => {
    vi.stubGlobal('isSecureContext', false)

    await expect(encryptFeedback(
      { category: 'bug', message: 'The pantry count is wrong' },
      await encryptionConfig(),
    )).rejects.toThrow('Feedback needs a secure connection. Please open Grovely over HTTPS, then try again.')
  })

  it('explains when the browser cannot encrypt feedback', async () => {
    const configured = await encryptionConfig()
    vi.stubGlobal('crypto', {})

    await expect(encryptFeedback(
      { category: 'bug', message: 'The pantry count is wrong' },
      configured,
    )).rejects.toThrow("Your browser can't send encrypted feedback. Try updating it or using another browser.")
  })

  it('creates an envelope without plaintext message or email', async () => {
    const envelope = await encryptFeedback(
      { category: 'encouragement', message: 'The pantry count is wrong', email: 'person@example.test' },
      await encryptionConfig(),
    )

    expect(envelope.category).toBe('encouragement')
    expect(envelope.ephemeralPublicKey).toHaveLength(87)
    expect(envelope.iv).toHaveLength(16)
    expect(JSON.stringify(envelope)).not.toContain('person@example.test')
    expect(JSON.stringify(envelope)).not.toContain('The pantry count is wrong')
  })

  it('sends only the encrypted envelope without browser credentials or a referrer', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 202 }))
    const configured = await encryptionConfig()

    await submitFeedback({ category: 'feature-request', message: 'Please add labels' }, configured)

    expect(fetchMock).toHaveBeenCalledWith(configured.endpoint, expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }))
    const request = fetchMock.mock.calls[0]?.[1]
    expect(request?.body).not.toContain('Please add labels')
  })

  it('explains connection, validation, size, rate-limit, and service errors', async () => {
    const configured = await encryptionConfig()
    const fields = { category: 'bug' as const, message: 'The pantry count is wrong' }
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(submitFeedback(fields, configured)).rejects.toThrow("We couldn't send feedback right now. Please try again in a moment.")

    const errorCases: Array<[number, string]> = [
      [400, 'Something went wrong with this feedback. Please try again.'],
      [413, 'That message is a little too long. Try shortening it and sending again.'],
      [503, 'The feedback service is having trouble right now. Please try again later.'],
      [429, "We couldn't send feedback right now. Please try again in a moment."],
    ]
    for (const [status, message] of errorCases) {
      fetchMock.mockResolvedValueOnce(new Response(null, { status }))
      await expect(submitFeedback(fields, configured)).rejects.toThrow(message)
    }
  })
})
