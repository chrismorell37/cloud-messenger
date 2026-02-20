import { get, set, del, keys } from 'idb-keyval'

export interface VoiceNoteDraft {
  id: string
  blob: Blob
  duration: number
  createdAt: number
  retryCount: number
  mimeType: string
}

const DRAFT_PREFIX = 'voice-draft-'

export async function saveDraft(draft: VoiceNoteDraft): Promise<void> {
  await set(`${DRAFT_PREFIX}${draft.id}`, draft)
}

export async function getDraft(id: string): Promise<VoiceNoteDraft | undefined> {
  return await get(`${DRAFT_PREFIX}${id}`)
}

export async function deleteDraft(id: string): Promise<void> {
  await del(`${DRAFT_PREFIX}${id}`)
}

export async function getAllDrafts(): Promise<VoiceNoteDraft[]> {
  const allKeys = await keys()
  const draftKeys = allKeys.filter(
    (key) => typeof key === 'string' && key.startsWith(DRAFT_PREFIX)
  )
  
  const drafts: VoiceNoteDraft[] = []
  for (const key of draftKeys) {
    const draft = await get(key)
    if (draft) {
      drafts.push(draft as VoiceNoteDraft)
    }
  }
  
  return drafts.sort((a, b) => b.createdAt - a.createdAt)
}

export async function updateDraftRetryCount(id: string): Promise<void> {
  const draft = await getDraft(id)
  if (draft) {
    draft.retryCount += 1
    await saveDraft(draft)
  }
}

export function generateDraftId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
