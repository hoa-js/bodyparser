import type { HoaContext, HoaMiddleware } from 'hoa'

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

export function bodyParser(options?: BodyparserOptions): HoaMiddleware

export default bodyParser
