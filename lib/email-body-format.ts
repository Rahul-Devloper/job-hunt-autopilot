/**
 * Shared plain-text → HTML formatting for outbound emails.
 *
 * The composer stores the message body as a raw string (a plain <textarea>),
 * so any link detection has to happen when the HTML version of the email is
 * assembled — not by mutating what the user types. Both the send route and the
 * composer's live preview call `formatBodyForHtml` so what the user previews
 * matches what the recipient receives.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Auto-linkify a single, already HTML-escaped line. Handles Markdown-style
 * [label](url) links and bare URLs (http/https, or a leading www.). URLs that
 * already sit inside an <a> tag — e.g. from a template default — are left
 * untouched so we never double-wrap.
 */
export function linkifyLine(line: string): string {
  const withMarkdownLinks = line.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/gi,
    (_match, label: string, url: string) => {
      const href = url.startsWith('www.') ? `https://${url}` : url
      return `<a href="${href}">${label}</a>`
    }
  )

  return withMarkdownLinks
    .split(/(<a\b[^>]*>.*?<\/a>)/gi)
    .map((segment, i) => {
      if (i % 2 === 1) return segment // the captured <a>…</a> chunks — leave alone
      return segment.replace(/(?:https?:\/\/|www\.)[^\s<]+/gi, (match) => {
        // Peel trailing sentence punctuation and escaped entities back out of
        // the link so "…site.com." keeps the period as text, and "<site.com>"
        // (escaped to "&lt;site.com&gt;") doesn't swallow the "&gt;".
        let url = match
        let suffix = ''
        const trail = url.match(/(?:&(?:amp|lt|gt);|[.,;:!?'"\]}])+$/)
        if (trail) {
          suffix = trail[0]
          url = url.slice(0, -suffix.length)
        }
        // A single trailing ")" is punctuation unless the URL itself opened a
        // paren (e.g. a Wikipedia "..._(disambiguation)" link).
        if (url.endsWith(')') && !url.includes('(')) {
          suffix = ')' + suffix
          url = url.slice(0, -1)
        }
        // "www." URLs need a scheme in the href, but the visible text stays
        // exactly as the user typed it.
        const href = url.startsWith('www.') ? `https://${url}` : url
        return `<a href="${href}">${url}</a>${suffix}`
      })
    })
    .join('')
}

/**
 * Convert the plain-text draft body into spaced HTML. Blank lines are skipped —
 * spacing comes only from block margins below, never from both <br> and margins
 * at once, or gaps double up. Bullets stay tightly grouped; paragraphs get
 * clear separation. `**bold**` becomes <strong>, and URLs become links.
 */
export function formatBodyForHtml(body: string): string {
  const formatted = escapeHtml(body).replace(
    /\*\*(.+?)\*\*/g,
    '<strong>$1</strong>'
  )

  const lines = formatted.split('\n').map((l) => l.trim())
  const html: string[] = []

  for (const line of lines) {
    if (line === '') {
      // skip blank lines — spacing is handled by block margins, not <br>
      continue
    }

    const content = linkifyLine(line)

    if (line.startsWith('•') || line.startsWith('-')) {
      // bullets: tight spacing within the group
      html.push(`<div style="margin: 2px 0;">${content}</div>`)
    } else {
      // paragraphs: normal spacing
      html.push(`<div style="margin: 0 0 12px 0;">${content}</div>`)
    }
  }

  return html.join('')
}
