const BASE_MIME = {
  json: [
    'application/json',
    'application/json-patch+json',
    'application/vnd.api+json',
    'application/csp-report',
    'application/reports+json',
    'application/scim+json'
  ],
  form: ['application/x-www-form-urlencoded'],
  text: ['text/plain']
}

/**
 * Merge base MIME type list with user-provided extra types.
 * Normalizes to lowercase and deduplicates via Set.
 *
 * @param {string[]} base - Built-in MIME types for a category (e.g., json/form/text)
 * @param {string[]} [extra] - Extra MIME types from options.extendTypes
 * @returns {string[]} A normalized, deduplicated list of MIME types
 */
function mergeMimes (base, extra) {
  const set = new Set()
  for (const t of base) {
    set.add(t.toLowerCase())
  }
  if (Array.isArray(extra)) {
    for (const t of extra) {
      if (typeof t === 'string' && t) set.add(t.toLowerCase())
    }
  }
  return Array.from(set)
}

/**
 * Parse a size limit expressed as number or human-readable string.
 * Supports: number (bytes), string ("56kb", "1mb", "2gb"), null/undefined (Infinity).
 *
 * @param {string|number|null|undefined} limit - The limit input from options
 * @returns {number} Parsed limit in bytes (or Infinity)
 * @throws {Error} If the string format is invalid or type unsupported
 */
function parseLimit (limit) {
  if (limit == null) return Infinity
  if (typeof limit === 'number' && Number.isFinite(limit)) return limit
  if (typeof limit === 'string') {
    const m = limit.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/)
    if (!m) throw new Error(`Invalid limit: ${limit}`)
    const n = parseFloat(m[1])
    const unit = m[2] || 'b'
    const mult = unit === 'gb' ? 1024 ** 3 : unit === 'mb' ? 1024 ** 2 : unit === 'kb' ? 1024 : 1
    return Math.floor(n * mult)
  }
  throw new Error(`Unsupported limit type: ${typeof limit}`)
}

/**
 * Body parser middleware for Hoa.
 *
 * Parses request bodies based on Content-Type and assigns the parsed result to ctx.req.body.
 * If parsing fails and no onError handler is provided, throws an error.
 *
 * @param {Object} [options] - Configuration options
 * @param {Array<'json'|'form'|'text'>} [options.enableTypes=['json','form']] - Enable specific body types to parse
 * @param {string|number} [options.formLimit='56kb'] - Maximum size for application/x-www-form-urlencoded bodies
 * @param {string|number} [options.jsonLimit='1mb'] - Maximum size for JSON bodies
 * @param {string|number} [options.textLimit='1mb'] - Maximum size for text/plain bodies
 * @param {{json?: string[], form?: string[], text?: string[]}} [options.extendTypes] - Extra MIME types to treat as json/form/text
 * @param {(error: Error, ctx: import('hoa').HoaContext) => void} [options.onError] - Custom error handler; if provided, errors won't throw
 * @param {string[]} [options.parsedMethods=['POST','PUT','PATCH']] - HTTP methods whose bodies will be parsed
 * @param {boolean} [options.useClone=true] - Whether to use Request.clone() to read the body; if false, consumes the original stream
 * @returns {(ctx: import('hoa').HoaContext, next: () => Promise<void>) => Promise<void>} Hoa middleware function
 */
export function bodyParser (options = {}) {
  const defaults = {
    enableTypes: ['json', 'form'],
    parsedMethods: ['POST', 'PUT', 'PATCH'],
    formLimit: '56kb',
    jsonLimit: '1mb',
    textLimit: '1mb',
    extendTypes: {},
    useClone: true
  }

  const opts = { ...defaults, ...options }

  const mimeTypes = {
    json: mergeMimes(BASE_MIME.json, opts.extendTypes?.json),
    form: mergeMimes(BASE_MIME.form, opts.extendTypes?.form),
    text: mergeMimes(BASE_MIME.text, opts.extendTypes?.text)
  }

  function isEnabled (type) {
    return Array.isArray(opts.enableTypes) && opts.enableTypes.includes(type)
  }

  function methodShouldParse (method) {
    return opts.parsedMethods?.includes(String(method).toUpperCase())
  }

  function matchTypes (reqType, type) {
    return reqType && mimeTypes[type].includes(reqType)
  }

  async function parseJsonFromBlob (blob, ctx) {
    const size = blob.size
    const limit = parseLimit(opts.jsonLimit)
    if (size > limit) return throwOrHandle(ctx, new Error('Request body too large for JSON'), 413)
    const text = await blob.text()
    try {
      return JSON.parse(text)
    } catch (e) {
      throwOrHandle(ctx, e, 400)
    }
  }

  async function parseFormFromBlob (blob, ctx) {
    const size = blob.size
    const limit = parseLimit(opts.formLimit)
    if (size > limit) return throwOrHandle(ctx, new Error('Request body too large for form'), 413)
    const text = await blob.text()
    const params = new URLSearchParams(text)
    const obj = Object.create(null)
    for (const [k, v] of params.entries()) {
      const cur = obj[k]
      if (cur === undefined) obj[k] = v
      else if (Array.isArray(cur)) cur.push(v)
      else obj[k] = [cur, v]
    }
    return obj
  }

  async function parseTextFromBlob (blob, ctx) {
    const size = blob.size
    const limit = parseLimit(opts.textLimit)
    if (size > limit) return throwOrHandle(ctx, new Error('Request body too large for text'), 413)
    return blob.text()
  }

  function throwOrHandle (ctx, err, status) {
    if (typeof opts.onError === 'function') {
      opts.onError(err, ctx)
      return
    }
    ctx.throw(status, err.message, { cause: err })
  }

  return async function hoaBodyParser (ctx, next) {
    const method = ctx.req.method
    if (!methodShouldParse(method)) return next()

    // Skip if body already parsed (not a ReadableStream)
    if (ctx.req.body !== undefined && !(ctx.req.body instanceof ReadableStream)) return next()

    const reqType = ctx.req.type
    let parseAs
    if (isEnabled('json') && matchTypes(reqType, 'json')) parseAs = 'json'
    else if (isEnabled('form') && matchTypes(reqType, 'form')) parseAs = 'form'
    else if (isEnabled('text') && matchTypes(reqType, 'text')) parseAs = 'text'
    if (!parseAs) return next()

    // Read the body depending on useClone option
    let blob
    try {
      blob = opts.useClone
        ? await ctx.request.clone().blob()
        : await ctx.req.blob()
    } catch (e) {
      return throwOrHandle(ctx, e, 400)
    }

    let parsed
    if (parseAs === 'json') parsed = await parseJsonFromBlob(blob, ctx)
    else if (parseAs === 'form') parsed = await parseFormFromBlob(blob, ctx)
    else parsed = await parseTextFromBlob(blob, ctx)

    ctx.req.body = parsed

    await next()
  }
}

export default bodyParser
