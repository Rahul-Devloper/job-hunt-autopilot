/**
 * Run with: npm test   (Node's built-in test runner, no extra deps)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { formatBodyForHtml, linkifyLine } from './email-body-format.ts'

test('bare https URL becomes a link', () => {
  assert.equal(
    linkifyLine('See https://example.com now'),
    'See <a href="https://example.com">https://example.com</a> now'
  )
})

test('www. URL gets an https href but keeps the typed display text', () => {
  assert.equal(
    linkifyLine('Visit www.example.com today'),
    'Visit <a href="https://www.example.com">www.example.com</a> today'
  )
})

test('trailing period is not swallowed into the href', () => {
  assert.equal(
    linkifyLine('portfolio at https://me.dev/work.'),
    'portfolio at <a href="https://me.dev/work">https://me.dev/work</a>.'
  )
})

test('trailing comma is not swallowed into the href', () => {
  assert.equal(
    linkifyLine('sites: https://a.com, https://b.com'),
    'sites: <a href="https://a.com">https://a.com</a>, <a href="https://b.com">https://b.com</a>'
  )
})

test('a URL wrapped in parens keeps the parens as text', () => {
  assert.equal(
    linkifyLine('(https://example.com)'),
    '(<a href="https://example.com">https://example.com</a>)'
  )
})

test('balanced parens inside the URL are preserved', () => {
  assert.equal(
    linkifyLine('ref https://en.wikipedia.org/wiki/Foo_(bar) here'),
    'ref <a href="https://en.wikipedia.org/wiki/Foo_(bar)">https://en.wikipedia.org/wiki/Foo_(bar)</a> here'
  )
})

test('markdown-style [label](url) links are supported', () => {
  assert.equal(
    linkifyLine('my [portfolio](https://me.dev) is here'),
    'my <a href="https://me.dev">portfolio</a> is here'
  )
})

test('URLs already inside an <a> tag are not double-wrapped', () => {
  const input = '<a href="https://x.com">https://x.com</a> and https://y.com'
  assert.equal(
    linkifyLine(input),
    '<a href="https://x.com">https://x.com</a> and <a href="https://y.com">https://y.com</a>'
  )
})

test('query strings with & survive (escaped) and stay in the href', () => {
  assert.equal(
    formatBodyForHtml('link: https://a.com/x?p=1&q=2'),
    '<div style="margin: 0 0 12px 0;">link: <a href="https://a.com/x?p=1&amp;q=2">https://a.com/x?p=1&amp;q=2</a></div>'
  )
})

test('formatBodyForHtml escapes HTML in the body', () => {
  assert.equal(
    formatBodyForHtml('a < b & c > d'),
    '<div style="margin: 0 0 12px 0;">a &lt; b &amp; c &gt; d</div>'
  )
})

test('formatBodyForHtml still handles **bold** and bullets', () => {
  assert.equal(
    formatBodyForHtml('**Hi there**\n• first\n• second'),
    '<div style="margin: 0 0 12px 0;"><strong>Hi there</strong></div>' +
      '<div style="margin: 2px 0;">• first</div>' +
      '<div style="margin: 2px 0;">• second</div>'
  )
})
