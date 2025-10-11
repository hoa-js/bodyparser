## @hoajs/bodyparser

Body parser middleware for Hoa.

## Installation

```bash
$ npm i @hoajs/bodyparser --save
```

## Quick Start

```js
import { Hoa } from 'hoa'
import { bodyParser } from '@hoajs/bodyparser'

const app = new Hoa()
app.use(bodyParser())

app.use(async (ctx) => {
  ctx.res.body = ctx.req.body
})

export default app
```

## Documentation

The documentation is available on [hoa-js.com](https://hoa-js.com/middleware/bodyparser.html)

## Test (100% coverage)

```sh
$ npm test
```

## License

MIT
