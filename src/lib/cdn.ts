const CDN_URL = import.meta.env.VITE_CDN_URL || ''
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

/**
 * Convert a Supabase storage URL to use the Cloudflare CDN
 * 
 * Supabase URL: https://xxx.supabase.co/storage/v1/object/public/media/uploads/file.jpg
 * CDN URL:      https://media-proxy.xxx.workers.dev/media/uploads/file.jpg
 */
export function toCdnUrl(supabaseUrl: string): string {
  if (!CDN_URL || !supabaseUrl) return supabaseUrl
  
  // Extract the path after /storage/v1/object/public/
  const match = supabaseUrl.match(/\/storage\/v1\/object\/public\/(.+)$/)
  if (!match) return supabaseUrl
  
  const path = match[1]
  return `${CDN_URL}/${path}`
}

/**
 * Convert a CDN URL back to Supabase URL (for uploads, etc.)
 */
export function toSupabaseUrl(cdnUrl: string): string {
  if (!CDN_URL || !SUPABASE_URL || !cdnUrl.startsWith(CDN_URL)) return cdnUrl
  
  const path = cdnUrl.replace(CDN_URL + '/', '')
  return `${SUPABASE_URL}/storage/v1/object/public/${path}`
}

/**
 * Check if CDN is configured
 */
export function isCdnEnabled(): boolean {
  return !!CDN_URL
}
