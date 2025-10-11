import type { HoaContext } from 'hoa'

export type BodyparserOptions = {
  enableTypes?: Array<'json' | 'form' | 'text'>
  formLimit?: string | number
  jsonLimit?: string | number
  textLimit?: string | number
  extendTypes?: {
    json?: string[]
    form?: string[]
    text?: string[]
  }
  onError?: (error: Error, ctx: HoaContext) => void
  parsedMethods?: string[]
  useClone?: boolean
}

export type BodyparserMiddleware = (ctx: HoaContext, next: () => Promise<void>) => Promise<void>

export function bodyParser(options?: BodyparserOptions): BodyparserMiddleware

export default bodyParser
