// Form utilities for validation and slug generation

/**
 * Convert text to URL-friendly slug
 * @param text - Text to convert
 * @returns URL-friendly slug
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^\w\-]+/g, '') // Remove special characters
    .replace(/\-+/g, '-') // Replace multiple hyphens with single
    .replace(/^\-+|\-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate excerpt from markdown content
 * @param markdown - Markdown content
 * @param length - Character length for excerpt
 * @returns Plain text excerpt
 */
export function generateExcerpt(markdown: string, length = 150): string {
  // Remove markdown syntax
  const plainText = markdown
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italics
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
    .replace(/^-\s+/gm, '') // Remove bullet points
    .replace(/`(.+?)`/g, '$1') // Remove inline code
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  if (plainText.length > length) {
    return plainText.substring(0, length).trim() + '...';
  }
  return plainText;
}

/**
 * Validate slug format
 * @param slug - Slug to validate
 * @returns Validation result
 */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.length === 0) {
    return { valid: false, error: 'Slug is required' };
  }

  if (slug.length > 100) {
    return { valid: false, error: 'Slug must be less than 100 characters' };
  }

  if (!/^[a-z0-9\-]+$/.test(slug)) {
    return {
      valid: false,
      error: 'Slug can only contain lowercase letters, numbers, and hyphens'
    };
  }

  if (/^\-|\-$/.test(slug)) {
    return { valid: false, error: 'Slug cannot start or end with a hyphen' };
  }

  return { valid: true };
}

/**
 * Validate title
 * @param title - Title to validate
 * @param maxLength - Maximum length
 * @returns Validation result
 */
export function validateTitle(title: string, maxLength = 200): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Title is required' };
  }

  if (title.length > maxLength) {
    return { valid: false, error: `Title must be less than ${maxLength} characters` };
  }

  return { valid: true };
}

/**
 * Validate markdown content
 * @param content - Markdown content to validate
 * @param minLength - Minimum length
 * @returns Validation result
 */
export function validateContent(content: string, minLength = 10): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Content is required' };
  }

  if (content.length < minLength) {
    return { valid: false, error: `Content must be at least ${minLength} characters` };
  }

  return { valid: true };
}

/**
 * Validate email
 * @param email - Email to validate
 * @returns Validation result
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true };
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Validation result
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  return { valid: true };
}

/**
 * Debounce function for real-time validation
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Format character count with max length
 * @param current - Current character count
 * @param max - Maximum character count
 * @returns Formatted string
 */
export function formatCharCount(current: number, max: number): string {
  return `${current}/${max} characters`;
}

/**
 * Check if form has unsaved changes
 * @param formData - Current form data
 * @param savedData - Previously saved data
 * @returns Boolean indicating if there are unsaved changes
 */
export function hasUnsavedChanges(formData: Record<string, any>, savedData: Record<string, any>): boolean {
  return JSON.stringify(formData) !== JSON.stringify(savedData);
}
