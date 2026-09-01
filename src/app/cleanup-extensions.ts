/**
 * HeatPulse — Browser Extension Attribute Cleanup
 *
 * Strips attributes injected by browser extensions (Bisect, A/B testing tools)
 * that cause React hydration warnings. Runs synchronously in the head before
 * React hydration begins.
 */
if (typeof document !== 'undefined') {
  // Run immediately — before React hydrates
  ;(function cleanup() {
    try {
      const attrs = ['bis_skin_checked', 'bis_register']
      document.querySelectorAll('*').forEach((el) => {
        for (const attr of attrs) {
          el.removeAttribute(attr)
        }
        // Remove any __processed_* attributes
        for (let i = el.attributes.length - 1; i >= 0; i--) {
          const name = el.attributes[i].name
          if (name.startsWith('__processed_')) el.removeAttribute(name)
        }
      })
    } catch {
      // Silent fail — extension attributes are harmless
    }
  })()
}
