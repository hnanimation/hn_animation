/**
 * ContentItem — نموذج موحد لكل نتيجة من الشبكة.
 * مبني على Section 4 spec.
 */

export function createContentItem({
  id,
  connectorId,
  type = 'image',
  title = '',
  description = '',
  creator = { name: '', url: '' },
  source = { platform: '', name: '', url: '' },
  originalUrl = '',
  thumbnail = { url: '', source: 'external' },
  mediaUrl = '',
  videoMode = 'direct',   // 'direct' (mp4) | 'embed' (iframe)
  publishedAt = null,
  duration = null,
  language = null,
  tags = [],
  categories = [],
  license = null,
  statistics = {},
  capabilities = {},
  raw = null
} = {}) {
  return {
    id: String(id || ''),
    connector_id: String(connectorId || ''),
    type,
    title: String(title || ''),
    description: String(description || ''),
    creator: {
      name: String(creator.name || ''),
      url: String(creator.url || '')
    },
    source: {
      platform: String(source.platform || ''),
      name: String(source.name || ''),
      url: String(source.url || '')
    },
    original_url: String(originalUrl || ''),
    thumbnail: {
      url: String(thumbnail.url || ''),
      source: thumbnail.source || 'external'
    },
    media_url: String(mediaUrl || ''),
    video_mode: videoMode,
    published_at: publishedAt,
    duration,
    language,
    tags: Array.isArray(tags) ? tags : [],
    categories: Array.isArray(categories) ? categories : [],
    license: license || null,
    statistics: statistics || {},
    capabilities: capabilities || {},
    retrieved_at: new Date().toISOString(),
    raw
  };
}