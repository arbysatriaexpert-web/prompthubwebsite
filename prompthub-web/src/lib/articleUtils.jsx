/**
 * Helper bersama untuk halaman Info AI, Tips & Trik, dan detail artikel.
 *
 * Semua fungsi di sini sengaja tidak memakai dangerouslySetInnerHTML.
 * Isi artikel diubah menjadi elemen React satu per satu, jadi teks apa pun
 * yang diketik admin tidak pernah bisa berubah menjadi HTML/skrip aktif.
 */

/* ────────────────────────────────────────────────────────────
 * 1. URL aman
 *    Kolom seperti external_url / tool_url / link_url diisi manual dari
 *    panel. Kalau isinya "javascript:..." browser akan menjalankannya saat
 *    diklik. Jadi hanya http dan https yang diloloskan.
 * ──────────────────────────────────────────────────────────── */
export function safeUrl(raw) {
  const url = (raw || '').trim()
  if (!url) return ''
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href
    return ''
  } catch {
    return ''
  }
}

/* ────────────────────────────────────────────────────────────
 * 2. Teks polos dari isi artikel (untuk ringkasan kartu)
 * ──────────────────────────────────────────────────────────── */
export function plainText(raw) {
  return (raw || '')
    .replace(/```[\s\S]*?```/g, ' ')      // blok kode
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // gambar markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link markdown -> teksnya saja
    .replace(/<[^>]+>/g, ' ')              // tag HTML kalau ada
    .replace(/[#>*_`~-]{1,}/g, ' ')        // sisa tanda markdown
    .replace(/\s+/g, ' ')
    .trim()
}

/** Ringkasan singkat untuk kartu. Dipotong di spasi, bukan di tengah kata. */
export function makeExcerpt(raw, max = 130) {
  const text = plainText(raw)
  if (!text) return ''
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

/* ────────────────────────────────────────────────────────────
 * 3. Tanggal & perkiraan waktu baca
 * ──────────────────────────────────────────────────────────── */
export function formatDate(value, style = 'long') {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('id-ID',
    style === 'short'
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'long', year: 'numeric' })
}

export function readingTime(raw) {
  const words = plainText(raw).split(' ').filter(Boolean).length
  if (words < 20) return 0
  return Math.max(1, Math.round(words / 200))
}

/* ────────────────────────────────────────────────────────────
 * 4. Penata teks sederhana (markdown ringan)
 *    Panel menulis "Konten (Markdown)", jadi web user harus bisa
 *    menampilkannya rapi. Yang didukung:
 *      # ## ###      judul
 *      - / * / 1.    daftar
 *      >             kutipan
 *      ---           garis pemisah
 *      **tebal**  *miring*  `kode`  [teks](https://...)
 * ──────────────────────────────────────────────────────────── */
function renderInline(text, keyPrefix) {
  const out = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g
  let last = 0
  let match
  let i = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyPrefix}-i${i++}`

    if (token.startsWith('**')) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      out.push(<code key={key} className="ah-code">{token.slice(1, -1)}</code>)
    } else if (token.startsWith('[')) {
      const label = token.slice(1, token.indexOf(']'))
      const href = safeUrl(token.slice(token.indexOf('(') + 1, -1))
      out.push(href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="ah-inline-link">{label}</a>
        : <span key={key}>{label}</span>)
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>)
    }
    last = match.index + token.length
  }

  if (last < text.length) out.push(text.slice(last))
  return out
}

export function RichText({ text }) {
  const source = (text || '').replace(/\r\n/g, '\n')
  if (!source.trim()) return null

  const lines = source.split('\n')
  const blocks = []
  let paragraph = []
  let list = null // { ordered: boolean, items: string[] }

  function flushParagraph() {
    if (paragraph.length === 0) return
    const key = `p${blocks.length}`
    blocks.push(<p key={key} className="ah-p">{renderInline(paragraph.join(' '), key)}</p>)
    paragraph = []
  }

  function flushList() {
    if (!list) return
    const key = `l${blocks.length}`
    const items = list.items.map((item, idx) => (
      <li key={`${key}-${idx}`}>{renderInline(item, `${key}-${idx}`)}</li>
    ))
    blocks.push(list.ordered
      ? <ol key={key} className="ah-list">{items}</ol>
      : <ul key={key} className="ah-list">{items}</ul>)
    list = null
  }

  function flushAll() { flushParagraph(); flushList() }

  lines.forEach(rawLine => {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) { flushAll(); return }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll()
      blocks.push(<hr key={`h${blocks.length}`} className="ah-rule" />)
      return
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      flushAll()
      const level = Math.min(heading[1].length + 1, 4) // # -> h2
      const Tag = `h${level}`
      const key = `t${blocks.length}`
      blocks.push(<Tag key={key} className={`ah-h ah-h${level}`}>{renderInline(heading[2], key)}</Tag>)
      return
    }

    const quote = trimmed.match(/^>\s?(.*)$/)
    if (quote) {
      flushAll()
      const key = `q${blocks.length}`
      blocks.push(<blockquote key={key} className="ah-quote">{renderInline(quote[1], key)}</blockquote>)
      return
    }

    const bullet = trimmed.match(/^[-*•]\s+(.*)$/)
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/)
    if (bullet || numbered) {
      flushParagraph()
      const ordered = !!numbered
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] } }
      list.items.push((bullet || numbered)[1])
      return
    }

    flushList()
    paragraph.push(trimmed)
  })

  flushAll()
  return <div className="ah-richtext">{blocks}</div>
}
