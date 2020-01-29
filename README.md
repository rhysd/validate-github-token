GitHub API Token Validation for Node.js
=======================================
[![CI workflow][ci-badge]][ci]
[![npm package][npm-badge]][npm]

[validate-github-token][repo] is a [npm package][npm] to validate [GitHub API][dev-gh] OAuth token.

This package can validate the given token

- is actually authorized by API endpoint
- has expected API scopes
- doesn't have unexpected API scopes

and returns the following information as the result of validation:

- API scopes which the given token has
- Rate limit

See [GitHub official authentication document][gh-auth] for more details.



## Installation

```
npm install --save validate-github-token
```



## JavaScript Example

```javascript
const { validateGitHubToken, ValidationError } = require('validate-github-token');

try {
    const validated = await validateGitHubToken(
        'your-secret-api-token',
        {
            scope: {
                // Checks 'public_repo' scope is added to the token
                included: ['public_repo']
            }
        }
    );

    console.log('Token scopes:', validated.scopes);
    console.log('API rate limit remaining:', validated.rateLimit.remaining);
} catch(err) {
    if (err instanceof ValidationError) {
        console.error(`Validation failed!: ${err.message}`);
    } else {
        throw err;
    }
}
```



## API

```typescript
import { validateGitHubToken, ValidationError } from 'validate-github-token';
// TypeScript only
import { ValidateOptions, RateLimit, Validated } from 'validate-github-token';
```


### `interface ValidateOptions`

A TypeScript interface for configuring the validation behvior. It's keys are as follows:

- `userName: string`: GitHub user name like `"rhysd"` for [@rhysd][me]. If this value is set, the endpoint will
  check the token against the user **Optional**
- `scope: Object`: Scope validation behavior **Optional**
  - `included: Array<string>`: Scope names which should be added to the token **Optional**
  - `excluded: Array<string>`: Scope names which should NOT be added to the token **Optional**
  - `exact: Array<string>`: Scope names should exactly match to scopes of the token **Optional**
- `agent: https.Agent`: Node.js HTTPS agent. For example please pass [https-proxy-agent][proxy] for proxy support **Optional**
- `endpointUrl: string`: Custom API endpoint URL. Deafult value is `"https://api.github.com"` **Optional**

e.g.

```ts
import {ValidateOptions} from 'validate-github-token';

const opts: ValidateOptions = {
    scope: {
        included: ['public_repo'],
        excluded: ['user'],
    },
    endpointUrl: 'https://github.your.company.com/api/v3',
};
```


### `async function validateGitHubToken()`

A function which validates the given token for the given user. Validation behavior can be configured
with the 3rd parameter. It returns the information given from API endpoint.

#### Parameters

- `token: string`: API token to be validated **Required**
- `options: Object`: Objects to configure validation behavior **Optional**

#### Return value

Returns a promise which is resolved to `Validated` interface object. Please read following 'interface Validated'
section for more details.

#### Exceptions

- `ValidationError`: Thrown when the given token is actually not authorized or its scopes don't meet `options.scope` option value
- `Error`: Thrown when unexpected errors such as network error happen


### `interface RateLimit`

A TypeScript interface contains the rate limit information returned from an API endpoint.
Please read [GitHub's official rate limit documentation][rate-limit] for more details.

- `limit: number`: Max rate limit count
- `remaining: number`: Remaining rate limit count
- `reset: Date`: The date when the rate limit count is reset


### `interface Validated`

A TypeScript interface contains the all information returned from API endpoint.

- `scopes: Array<string>`: An array of scope names added to the API token
- `rateLimit: RateLimit`: Rate limit information



## License

Distributed under [the MIT license](./LICENSE.txt).

[repo]: https://github.com/rhysd/validate-github-token
[npm]: https://www.npmjs.com/package/validate-github-token
[dev-gh]: https://developer.github.com/
[proxy]: https://www.npmjs.com/package/https-proxy-agent
[rate-limit]: https://developer.github.com/v3/rate_limit/
[me]: https://github.com/rhysd
[gh-auth]: https://developer.github.com/v3/#authentication
[ci-badge]: https://github.com/rhysd/validate-github-token/workflows/CI/badge.svg?branch=master&event=push
[ci]: https://github.com/rhysd/validate-github-token/actions?query=workflow%3ACI+branch%3Amaster
[npm-badge]: https://badge.fury.io/js/validate-github-token.svg
