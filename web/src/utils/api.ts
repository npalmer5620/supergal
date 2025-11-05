import { fetchWithAuth } from './auth';

const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8787/api';
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return API_BASE.replace(/\/api$/, '');
  }
})();

function withApiOrigin(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^(?:[a-z]+:)?\/\//i.test(path)) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  status?: 'draft' | 'published' | 'archived';
  authorId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
}

export interface ImageUrls {
  original?: string;
  thumbnail200?: string;
  thumbnail500?: string;
  thumbnail1000?: string;
}

export interface Image {
  id: string;
  title?: string | null;
  filename?: string;
  caption?: string | null;
  captionOverride?: string | null;
  altText?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
  urls?: ImageUrls;
}

export interface Gallery {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  status?: 'draft' | 'published' | 'archived';
  authorId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
  imageCount?: number;
  images?: Image[];
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

function ensureString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function coerceNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function normalizeTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const directDate = new Date(value as any);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate.toISOString();
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    const ms = numeric < 1e12 ? numeric * 1000 : numeric;
    const numericDate = new Date(ms);
    if (!Number.isNaN(numericDate.getTime())) {
      return numericDate.toISOString();
    }
  }

  return null;
}

function mapImage(data: any): Image {
  if (!data) {
    return {
      id: '',
      title: null,
      urls: {}
    };
  }

  const filename =
    data.filename ||
    (typeof data.file_path === 'string' ? data.file_path.split('/').pop() : undefined);

  const urlsInput: ImageUrls = data.urls || {};
  const thumbnailUrls = (data.thumbnail_urls ?? data.thumbnails ?? {}) as Record<string, string | undefined>;

  const resolvedUrls: ImageUrls = {};

  const originalUrl =
    urlsInput.original ||
    (typeof data.file_path === 'string' ? `/uploads/${data.file_path}` : undefined) ||
    (filename ? `/uploads/original/${filename}` : undefined);

  if (originalUrl) {
    resolvedUrls.original = withApiOrigin(originalUrl);
  }

  const maybeResolve = (value?: string) => (value ? withApiOrigin(value) : undefined);

  resolvedUrls.thumbnail200 = maybeResolve(urlsInput.thumbnail200 ?? thumbnailUrls['200'] ?? thumbnailUrls.small);
  resolvedUrls.thumbnail500 = maybeResolve(urlsInput.thumbnail500 ?? thumbnailUrls['500'] ?? thumbnailUrls.medium);
  resolvedUrls.thumbnail1000 = maybeResolve(urlsInput.thumbnail1000 ?? thumbnailUrls['1000'] ?? thumbnailUrls.large);

  return {
    id: ensureString(data.id ?? data.image_id ?? ''),
    title: data.title ?? null,
    filename,
    caption: data.caption ?? null,
    captionOverride: data.captionOverride ?? data.caption_override ?? null,
    altText: data.altText ?? data.alt_text ?? null,
    createdAt: normalizeTimestamp(data.createdAt ?? data.created_at),
    updatedAt: normalizeTimestamp(data.updatedAt ?? data.updated_at),
    mimeType: data.mimeType ?? data.mime_type ?? null,
    width: data.width ?? null,
    height: data.height ?? null,
    fileSize: data.fileSize ?? data.file_size ?? null,
    urls: resolvedUrls
  };
}

function mapPost(data: any): Post {
  if (!data) {
    return {
      id: '',
      title: '',
      slug: '',
      content: '',
      excerpt: null,
      status: 'draft',
      authorId: null,
      createdAt: null,
      updatedAt: null,
      publishedAt: null
    };
  }

  return {
    id: ensureString(data.id ?? ''),
    title: data.title ?? '',
    slug: data.slug ?? '',
    content: data.content ?? data.body_markdown ?? '',
    excerpt: data.excerpt ?? null,
    status: data.status ?? undefined,
    authorId: data.authorId ?? data.author_id ?? null,
    createdAt: normalizeTimestamp(data.createdAt ?? data.created_at),
    updatedAt: normalizeTimestamp(data.updatedAt ?? data.updated_at),
    publishedAt: normalizeTimestamp(data.publishedAt ?? data.published_at)
  };
}

function mapGallery(data: any): Gallery {
  if (!data) {
    return {
      id: '',
      title: '',
      slug: '',
      description: null,
      status: 'draft',
      authorId: null,
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
      images: []
    };
  }

  return {
    id: ensureString(data.id ?? ''),
    title: data.title ?? '',
    slug: data.slug ?? '',
    description: data.description ?? null,
    status: data.status ?? undefined,
    authorId: data.authorId ?? data.author_id ?? null,
    createdAt: normalizeTimestamp(data.createdAt ?? data.created_at),
    updatedAt: normalizeTimestamp(data.updatedAt ?? data.updated_at),
    publishedAt: normalizeTimestamp(data.publishedAt ?? data.published_at),
    imageCount: coerceNumber(data.imageCount ?? data.image_count) ?? (Array.isArray(data.images) ? data.images.length : undefined),
    images: Array.isArray(data.images) ? data.images.map(mapImage) : data.images
  };
}

function mapTag(data: any): Tag {
  return {
    id: ensureString(data.id ?? ''),
    name: data.name ?? '',
    slug: data.slug ?? ''
  };
}

function unwrap<T>(payload: any, key: string): T | undefined {
  if (payload && typeof payload === 'object' && key in payload) {
    return payload[key];
  }
  return payload;
}

function buildPostPayload(post: Partial<Post>) {
  return {
    slug: post.slug,
    title: post.title,
    content: post.content,
    status: post.status
  };
}

function buildGalleryPayload(gallery: Partial<Gallery>) {
  return {
    slug: gallery.slug,
    title: gallery.title,
    description: gallery.description,
    status: gallery.status
  };
}

// Posts API
export async function getPosts(page = 1, limit = 10): Promise<ApiResponse<Post[]>> {
  try {
    const response = await fetch(`${API_BASE}/posts?page=${page}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch posts');
    const json = await response.json();
    const posts = Array.isArray(json) ? json.map(mapPost) : [];
    return { success: true, data: posts };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getPost(identifier: string): Promise<ApiResponse<Post>> {
  try {
    const response = await fetch(`${API_BASE}/posts/${identifier}`);
    if (!response.ok) throw new Error('Post not found');
    const json = await response.json();
    return { success: true, data: mapPost(json) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function createPost(post: Partial<Post>): Promise<ApiResponse<Post>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildPostPayload(post))
    });
    if (!response.ok) throw new Error('Failed to create post');
    const json = await response.json();
    const payload = unwrap(json, 'post');
    return { success: true, data: mapPost(payload) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function updatePost(identifier: string, post: Partial<Post>): Promise<ApiResponse<Post>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/posts/${identifier}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildPostPayload(post))
    });
    if (!response.ok) throw new Error('Failed to update post');
    const json = await response.json();
    const payload = unwrap(json, 'post');
    return { success: true, data: mapPost(payload) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function patchPost(
  identifier: string,
  updates: { title?: string; status?: Post['status']; slug?: string; content?: string }
): Promise<ApiResponse<Post>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/posts/${identifier}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...updates
      })
    });
    if (!response.ok) throw new Error('Failed to update post');
    const json = await response.json();
    const payload = unwrap(json, 'post');
    return { success: true, data: mapPost(payload) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function deletePost(identifier: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/posts/${identifier}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete post');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Galleries API
export async function getGalleries(page = 1, limit = 10): Promise<ApiResponse<Gallery[]>> {
  try {
    const response = await fetch(`${API_BASE}/galleries?page=${page}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch galleries');
    const json = await response.json();
    const galleries = Array.isArray(json) ? json.map(mapGallery) : [];
    return { success: true, data: galleries };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getGallery(identifier: string): Promise<ApiResponse<Gallery>> {
  try {
    const response = await fetch(`${API_BASE}/galleries/${identifier}`);
    if (!response.ok) throw new Error('Gallery not found');
    const json = await response.json();
    const payload = unwrap(json, 'gallery');
    return { success: true, data: mapGallery(payload) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getGalleryById(identifier: string): Promise<ApiResponse<Gallery>> {
  return getGallery(identifier);
}

export async function createGallery(gallery: Partial<Gallery>): Promise<ApiResponse<Gallery>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/galleries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildGalleryPayload(gallery))
    });
    if (!response.ok) throw new Error('Failed to create gallery');
    const json = await response.json();
    const payload = unwrap(json, 'gallery');
    return { success: true, data: mapGallery(payload) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function updateGallery(identifier: string, gallery: Partial<Gallery>): Promise<ApiResponse<Gallery>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/galleries/${identifier}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildGalleryPayload(gallery))
    });
    if (!response.ok) throw new Error('Failed to update gallery');
    const json = await response.json();
    const payload = unwrap(json, 'gallery');
    return { success: true, data: mapGallery(payload) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function patchGallery(
  identifier: string,
  updates: { title?: string; status?: Gallery['status']; slug?: string; description?: string | null }
): Promise<ApiResponse<Gallery>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/galleries/${identifier}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update gallery');
    const json = await response.json();
    const payload = unwrap(json, 'gallery');
    return { success: true, data: mapGallery(payload) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function deleteGallery(identifier: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/galleries/${identifier}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete gallery');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function addImagesToGallery(
  galleryIdentifier: string,
  imageIds: string[],
  captionOverride?: string
): Promise<ApiResponse<{ position?: number }>> {
  try {
    if (!imageIds.length) {
      throw new Error('No image IDs provided');
    }
    const response = await fetchWithAuth(`${API_BASE}/galleries/${galleryIdentifier}/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image_id: imageIds[0], caption_override: captionOverride })
    });
    if (!response.ok) throw new Error('Failed to add image to gallery');
    return { success: true, data: await response.json() };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function removeImageFromGallery(
  galleryIdentifier: string,
  imageId: string
): Promise<ApiResponse<void>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/galleries/${galleryIdentifier}/images/${imageId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to remove image from gallery');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function reorderGalleryImages(
  galleryIdentifier: string,
  imageIds: string[]
): Promise<ApiResponse<Gallery>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/galleries/${galleryIdentifier}/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageIds })
    });
    if (!response.ok) throw new Error('Failed to reorder gallery images');
    const json = await response.json();
    const payload = unwrap(json, 'gallery');
    return { success: true, data: mapGallery(payload) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Images API
export async function getImages(page = 1, limit = 20): Promise<ApiResponse<Image[]>> {
  try {
    const response = await fetch(`${API_BASE}/images?page=${page}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch images');
    const json = await response.json();
    const images = Array.isArray(json) ? json.map(mapImage) : [];
    return { success: true, data: images };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function uploadImage(file: File): Promise<ApiResponse<Image>> {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetchWithAuth(`${API_BASE}/images`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error('Failed to upload image');
    const json = await response.json();
    const payload = unwrap(json, 'image') ?? json;
    return { success: true, data: mapImage(payload) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function deleteImage(identifier: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/images/${identifier}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete image');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Tags API
export async function getTags(): Promise<ApiResponse<Tag[]>> {
  try {
    const response = await fetch(`${API_BASE}/tags`);
    if (!response.ok) throw new Error('Failed to fetch tags');
    const json = await response.json();
    const tags = Array.isArray(json) ? json.map(mapTag) : [];
    return { success: true, data: tags };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function createTag(name: string): Promise<ApiResponse<Tag>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });
    if (!response.ok) throw new Error('Failed to create tag');
    const json = await response.json();
    const payload = unwrap(json, 'tag') ?? json;
    return { success: true, data: mapTag(payload) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function deleteTag(identifier: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/tags/${identifier}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete tag');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Search API
export async function search(query: string): Promise<ApiResponse<any>> {
  try {
    const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    return { success: true, data: await response.json() };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
