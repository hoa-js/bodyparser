import { Hoa } from 'hoa'
import { bodyParser } from '../src/bodyparser.js'

describe('Body parser Middleware for Hoa', () => {
  describe('Basic Parsing', () => {
    it('should parse JSON body', async () => {
      const app = new Hoa()
      app.use(bodyParser())
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test', value: 123 })
      }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ name: 'test', value: 123 })
    })

    it('should parse form body with duplicate keys as array', async () => {
      const app = new Hoa()
      app.use(bodyParser())
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'tags=a&tags=b&tags=c'
      }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ tags: ['a', 'b', 'c'] })
    })

    it('should parse text body when enabled', async () => {
      const app = new Hoa()
      app.use(bodyParser({ enableTypes: ['text'] }))
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'plain text content'
      }))
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('plain text content')
    })

    it('should parse various JSON MIME types', async () => {
      const mimeTypes = ['application/json-patch+json', 'application/vnd.api+json', 'application/csp-report']
      for (const mimeType of mimeTypes) {
        const app = new Hoa()
        app.use(bodyParser())
        app.use(async (ctx) => { ctx.res.body = ctx.req.body })
        const res = await app.fetch(new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': mimeType },
          body: JSON.stringify({ type: mimeType })
        }))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ type: mimeType })
      }
    })
  })

  describe('HTTP Methods & Filtering', () => {
    it('should skip parsing for GET requests', async () => {
      const app = new Hoa()
      app.use(bodyParser())
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }))
      expect([200, 204]).toContain(res.status)
    })

    it('should only parse specified methods', async () => {
      const app = new Hoa()
      app.use(bodyParser({ parsedMethods: ['POST', 'DELETE'] }))
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })

      // PUT should not be parsed
      const res1 = await app.fetch(new Request('http://localhost/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      }))
      expect(res1.status).toBe(200)

      // DELETE should be parsed
      const res2 = await app.fetch(new Request('http://localhost/', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete: true })
      }))
      expect(res2.status).toBe(200)
      expect(await res2.json()).toEqual({ delete: true })
    })

    it('should skip parsing when Content-Type does not match enabled types', async () => {
      const app = new Hoa()
      app.use(bodyParser({ enableTypes: ['json'] }))
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'name=test'
      }))
      expect(res.status).toBe(200)
    })

    it('should skip parsing if body already exists', async () => {
      const app = new Hoa()
      app.use(async (ctx, next) => {
        ctx.req.body = { preSet: true }
        await next()
      })
      app.use(bodyParser())
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shouldNotParse: true })
      }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ preSet: true })
    })
  })

  describe('Extended Types & Options', () => {
    it('should support extended MIME types', async () => {
      const app = new Hoa()
      app.use(bodyParser({
        extendTypes: {
          json: ['application/x-custom-json', null, '', 123, 'UPPERCASE'], // Include non-string values
          text: ['text/xml']
        },
        enableTypes: ['json', 'text']
      }))
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })

      const res1 = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-custom-json' },
        body: JSON.stringify({ custom: true })
      }))
      expect(res1.status).toBe(200)
      expect(await res1.json()).toEqual({ custom: true })

      const res2 = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: '<xml>test</xml>'
      }))
      expect(res2.status).toBe(200)
      expect(await res2.text()).toBe('<xml>test</xml>')
    })

    it('should handle useClone option', async () => {
      const app = new Hoa()
      app.use(bodyParser({ useClone: false }))
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clone: false })
      }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ clone: false })
    })

    it('should handle invalid option types gracefully', async () => {
      const app = new Hoa()
      app.use(bodyParser({
        enableTypes: 'json', // not an array
        parsedMethods: undefined,
        extendTypes: { json: 'not-an-array' }
      }))
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      }))
      expect(res.status).toBe(200)
    })
  })

  describe('Limit Handling', () => {
    it('should handle various limit formats', async () => {
      const limits = [50, '1kb', '1.5kb', '100b', '1 mb', '2gb', null, undefined, '100']
      for (const limit of limits) {
        const app = new Hoa()
        app.use(bodyParser({ jsonLimit: limit }))
        app.use(async (ctx) => { ctx.res.body = ctx.req.body })
        const res = await app.fetch(new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: 'test' })
        }))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ data: 'test' })
      }
    })

    it('should handle large data with null limit', async () => {
      const app = new Hoa()
      app.use(bodyParser({ jsonLimit: null }))
      app.use(async (ctx) => { ctx.res.body = ctx.req.body })
      const largeData = { data: 'x'.repeat(10000) }
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeData)
      }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(largeData)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid JSON with default error handler', async () => {
      const app = new Hoa()
      app.use(bodyParser())
      app.use(async (ctx) => { ctx.res.body = 'should not reach here' })
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json'
      }))
      expect(res.status).toBe(400)
    })

    it('should handle custom error handler', async () => {
      const app = new Hoa()
      app.use(bodyParser({
        onError: (_err, ctx) => {
          ctx.res.status = 422
          ctx.res.body = 'Custom error'
        }
      }))
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json'
      }))
      expect(res.status).toBe(422)
      expect(await res.text()).toBe('Custom error')
    })

    it('should handle body exceeding limits', async () => {
      // JSON limit
      const app1 = new Hoa()
      app1.use(bodyParser({ jsonLimit: '10b' }))
      const res1 = await app1.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'this is a very long string that exceeds the limit' })
      }))
      expect(res1.status).toBe(413)

      // Form limit
      let errorCaught = false
      const app2 = new Hoa()
      app2.use(bodyParser({
        formLimit: '5b',
        onError: (err, ctx) => {
          errorCaught = true
          ctx.res.status = 413
          ctx.res.body = err.message
        }
      }))
      const res2 = await app2.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'name=verylongvalue'
      }))
      expect(errorCaught).toBe(true)
      expect(res2.status).toBe(413)

      // Text limit
      const app3 = new Hoa()
      app3.use(bodyParser({ enableTypes: ['text'], textLimit: '5b' }))
      const res3 = await app3.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'this is a very long text that exceeds the limit'
      }))
      expect(res3.status).toBe(413)
    })

    it('should handle invalid limit formats', async () => {
      // Test with Symbol
      const app1 = new Hoa()
      app1.use(bodyParser({
        jsonLimit: Symbol('invalid'),
        onError: (_err, ctx) => {
          ctx.res.status = 500
          ctx.res.body = 'Error handled'
        }
      }))
      const res1 = await app1.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      }))
      expect([200, 500]).toContain(res1.status)

      // Test with invalid string
      const app2 = new Hoa()
      app2.use(bodyParser({
        jsonLimit: 'not-a-valid-limit',
        onError: (_err, ctx) => {
          ctx.res.status = 500
          ctx.res.body = 'Error handled'
        }
      }))
      const res2 = await app2.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      }))
      expect([200, 500]).toContain(res2.status)
    })

    it('should handle blob read error when body already consumed', async () => {
      let errorCaught = false
      const app = new Hoa()
      app.use(async (ctx, next) => {
        try {
          await ctx.req.blob()
        } catch (_e) {
          // Ignore
        }
        await next()
      })
      app.use(bodyParser({
        onError: (_err, ctx) => {
          errorCaught = true
          ctx.res.status = 400
          ctx.res.body = 'Blob read error'
        }
      }))
      const res = await app.fetch(new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      }))
      expect(errorCaught).toBe(true)
      expect(res.status).toBe(400)
      expect(await res.text()).toBe('Blob read error')
    })
  })
})
