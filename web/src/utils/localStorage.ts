// localStorage utilities for form auto-save and draft management

/**
 * Save form draft to localStorage
 * @param key - Storage key
 * @param data - Form data to save
 */
export function saveDraft(key: string, data: Record<string, any>): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const draft = {
      data,
      timestamp: new Date().getTime()
    };
    localStorage.setItem(`draft_${key}`, JSON.stringify(draft));
  } catch (error) {
    console.error('Error saving draft:', error);
  }
}

/**
 * Load form draft from localStorage
 * @param key - Storage key
 * @returns Draft data with timestamp, or null if not found
 */
export function loadDraft(key: string): { data: Record<string, any>; timestamp: number } | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const draft = localStorage.getItem(`draft_${key}`);
    if (!draft) return null;

    const parsed = JSON.parse(draft);
    return { data: parsed.data, timestamp: parsed.timestamp };
  } catch (error) {
    console.error('Error loading draft:', error);
    return null;
  }
}

/**
 * Check if draft exists
 * @param key - Storage key
 * @returns Boolean indicating if draft exists
 */
export function draftExists(key: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(`draft_${key}`) !== null;
}

/**
 * Clear form draft from localStorage
 * @param key - Storage key
 */
export function clearDraft(key: string): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem(`draft_${key}`);
  } catch (error) {
    console.error('Error clearing draft:', error);
  }
}

/**
 * Get time elapsed since draft was saved
 * @param timestamp - Timestamp when draft was saved
 * @returns Human-readable time string
 */
export function getTimeElapsed(timestamp: number): string {
  const now = new Date().getTime();
  const elapsed = Math.floor((now - timestamp) / 1000); // Convert to seconds

  if (elapsed < 60) return 'just now';
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)} min ago`;
  if (elapsed < 86400) return `${Math.floor(elapsed / 3600)} hours ago`;
  return `${Math.floor(elapsed / 86400)} days ago`;
}

/**
 * Setup auto-save for form
 * @param key - Storage key
 * @param getFormData - Function to get current form data
 * @param interval - Auto-save interval in milliseconds (default: 10000ms / 10s)
 * @returns Function to stop auto-save
 */
export function setupAutoSave(
  key: string,
  getFormData: () => Record<string, any>,
  interval: number = 10000
): () => void {
  const intervalId = setInterval(() => {
    const data = getFormData();
    saveDraft(key, data);

    // Dispatch custom event for UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('draft-saved', {
          detail: { timestamp: new Date().getTime() }
        })
      );
    }
  }, interval);

  // Return function to stop auto-save
  return () => clearInterval(intervalId);
}

/**
 * Get all draft keys
 * @returns Array of draft keys
 */
export function getAllDrafts(): string[] {
  if (typeof localStorage === 'undefined') return [];

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('draft_')) {
      keys.push(key.replace('draft_', ''));
    }
  }
  return keys;
}

/**
 * Clear all drafts
 */
export function clearAllDrafts(): void {
  if (typeof localStorage === 'undefined') return;

  const keys = getAllDrafts();
  keys.forEach(key => clearDraft(key));
}

/**
 * Get draft info (timestamp, size)
 * @param key - Storage key
 * @returns Draft info or null
 */
export function getDraftInfo(
  key: string
): { timestamp: number; size: number; timeElapsed: string } | null {
  const draft = loadDraft(key);
  if (!draft) return null;

  return {
    timestamp: draft.timestamp,
    size: new Blob([JSON.stringify(draft.data)]).size,
    timeElapsed: getTimeElapsed(draft.timestamp)
  };
}
