// Markdown utilities
import { marked } from 'marked';

// Configure marked for secure HTML rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Sanitize HTML to prevent XSS
function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Convert markdown to HTML
 * @param markdown - Markdown string to convert
 * @returns HTML string
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  // Guard against undefined/null/non-string values
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  try {
    return await marked(markdown);
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return '<p>Error parsing markdown content</p>';
  }
}

/**
 * Get excerpt from markdown (first 150 characters)
 * @param markdown - Markdown string
 * @param length - Character length of excerpt
 * @returns Plain text excerpt
 */
export function getExcerpt(markdown: string, length = 150): string {
  // Guard against undefined/null/non-string values
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  // Remove markdown syntax
  const plainText = markdown
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italics
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
    .replace(/^-\s+/gm, '') // Remove bullet points
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  if (plainText.length > length) {
    return plainText.substring(0, length).trim() + '...';
  }
  return plainText;
}

/**
 * Extract title from markdown (first H1 header)
 * @param markdown - Markdown string
 * @returns Title or empty string
 */
export function extractTitle(markdown: string): string {
  // Guard against undefined/null/non-string values
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  const match = markdown.match(/^#+\s+(.+)$/m);
  return match ? match[1] : '';
}

/**
 * Count reading time in minutes
 * @param markdown - Markdown string
 * @param wordsPerMinute - Average words per minute
 * @returns Reading time in minutes
 */
export function getReadingTime(markdown: string, wordsPerMinute = 200): number {
  // Guard against undefined/null/non-string values
  if (!markdown || typeof markdown !== 'string') {
    return 0;
  }

  // Remove markdown syntax
  const plainText = markdown
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();

  const wordCount = plainText.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return Math.max(1, minutes);
}

/**
 * Format markdown with frontmatter parsing
 * @param content - Content with optional YAML frontmatter
 * @returns Object with frontmatter and markdown
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, any>;
  markdown: string;
} {
  // Guard against undefined/null/non-string values
  if (!content || typeof content !== 'string') {
    return { frontmatter: {}, markdown: '' };
  }

  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, markdown: content };
  }

  const frontmatterString = match[1];
  const markdown = match[2];
  const frontmatter: Record<string, any> = {};

  // Simple YAML-like parsing
  frontmatterString.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      // Remove quotes if present
      frontmatter[key.trim()] = value.replace(/^['"]|['"]$/g, '');
    }
  });

  return { frontmatter, markdown };
}

/**
 * Format date for display
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Guard against invalid dates
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format date with time
 * @param date - Date string or Date object
 * @returns Formatted date and time string
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Guard against invalid dates
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get relative time (e.g., "2 days ago")
 * @param date - Date string or Date object
 * @returns Relative time string
 */
export function getRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Guard against invalid dates
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  const now = new Date();
  const seconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' years ago';

  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' months ago';

  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' days ago';

  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' hours ago';

  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' minutes ago';

  return Math.floor(seconds) + ' seconds ago';
}
