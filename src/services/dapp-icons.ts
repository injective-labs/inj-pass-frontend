/**
 * DApp Icon Service
 * Fetches and caches DApp icons/logos
 */

// Cache for DApp icons
const iconCache = new Map<string, string>();

/**
 * Get the favicon/icon URL for a DApp
 */
export function getDAppIconUrl(url: string): string {
  // Check cache first
  if (iconCache.has(url)) {
    return iconCache.get(url)!;
  }

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // Try multiple common icon locations
    const iconUrls = [
      `${urlObj.origin}/favicon.ico`,
      `${urlObj.origin}/favicon.png`,
      `${urlObj.origin}/apple-touch-icon.png`,
      `${urlObj.origin}/logo.png`,
      // Google's favicon service as fallback
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    ];

    // Return the first URL (we'll use onError in Image component to try next)
    const iconUrl = iconUrls[0];
    iconCache.set(url, iconUrl);
    return iconUrl;
  } catch (error) {
    console.error('[DAppIcons] Failed to get icon URL:', error);
    // Return Google favicon service as ultimate fallback
    return `https://www.google.com/s2/favicons?domain=${url}&sz=128`;
  }
}

/**
 * Preload DApp icon
 */
export async function preloadDAppIcon(url: string): Promise<string> {
  const iconUrl = getDAppIconUrl(url);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(iconUrl);
    img.onerror = () => {
      // If primary icon fails, try Google's favicon service
      const domain = new URL(url).hostname;
      const fallbackUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      resolve(fallbackUrl);
    };
    img.src = iconUrl;
  });
}

/**
 * Batch preload DApp icons
 */
export async function preloadDAppIcons(urls: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  await Promise.all(
    urls.map(async (url) => {
      try {
        const iconUrl = await preloadDAppIcon(url);
        results.set(url, iconUrl);
      } catch (error) {
        console.error(`[DAppIcons] Failed to preload icon for ${url}:`, error);
        // Use fallback
        const domain = new URL(url).hostname;
        results.set(url, `https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
      }
    })
  );
  
  return results;
}
