import { strict as assert } from 'assert';
import { validateGitHubToken, ValidateOptions, ValidationError } from '../index';

describe('validateGitHubToken()', function () {
    // Note: This token must have exact 'public_repo' and 'read:user' scopes
    const validToken = process.env.GITHUB_TOKEN ?? '';

    before(function () {
        if (validToken === '') {
            throw new Error(
                "$GITHUB_TOKEN environment variable is not set for testing, where the token must have exact 'public_repo' and 'read:user' scopes",
            );
        }
    });

    const normalCaseOptions: Array<ValidateOptions | undefined> = [
        {},
        {
            scope: {
                included: ['public_repo', 'read:user'],
            },
        },
        {
            scope: {
                excluded: ['user', 'read:org'],
            },
        },
        {
            userName: 'rhysd',
            scope: {
                included: ['public_repo', 'read:user'],
                excluded: ['user', 'read:org'],
            },
        },
        {
            scope: {
                exact: ['public_repo', 'read:user'],
            },
        },
        {
            scope: {
                exact: ['read:user', 'public_repo'],
            },
        },
    ];

    for (const opts of normalCaseOptions) {
        it(`validates token with correct options '${JSON.stringify(opts)}'`, async function () {
            const v = await validateGitHubToken(validToken, opts);
            assert.ok(v.rateLimit.remaining <= v.rateLimit.limit, JSON.stringify(v.rateLimit));
            assert.deepEqual(v.scopes, ['public_repo', 'read:user']);
            assert.ok(!v.scopes.includes('user'), JSON.stringify(v.scopes));
        });
    }

    const errorCases: Array<{
        when: string;
        token: string;
        options: ValidateOptions;
        error: typeof ValidationError | typeof Error;
        message: RegExp;
    }> = [
        {
            when: 'scope expected to be included is not included',
            token: validToken,
            options: {
                scope: {
                    included: ['user'],
                },
            },
            error: ValidationError,
            message: /Scope '.+' should be included in token scopes/,
        },
        {
            when: 'scope expected not to be included is included',
            token: validToken,
            options: {
                scope: {
                    excluded: ['public_repo'],
                },
            },
            error: ValidationError,
            message: /Scope '.+' should not be included in token scopes/,
        },
        {
            when: 'too many scopes are added to token for exact matching',
            token: validToken,
            options: {
                scope: {
                    exact: ['public_repo'],
                },
            },
            error: ValidationError,
            message: /don't exactly match to the expected scope/,
        },
        {
            when: 'too few scopes are added to token for exact matching',
            token: validToken,
            options: {
                scope: {
                    exact: ['public_repo', 'read:user', 'read:org'],
                },
            },
            error: ValidationError,
            message: /don't exactly match to the expected scope/,
        },
        {
            when: 'different scopes are added to token for exact matching',
            token: validToken,
            options: {
                scope: {
                    exact: ['public_repo', 'read:org'],
                },
            },
            error: ValidationError,
            message: /don't exactly match to the expected scope/,
        },
        {
            when: 'token is not valid',
            token: 'not-a-valid-token-yeah',
            options: {},
            error: ValidationError,
            message: /Unauthorized GitHub API token/,
        },
        {
            when: 'endpoint URL is not correct',
            token: validToken,
            options: {
                endpointUrl: 'https://does.not.exist.example.com',
            },
            error: Error,
            message: /Could not send a validation request/,
        },
        {
            when: 'endpoint URL is not valid URL',
            token: validToken,
            options: {
                endpointUrl: 'file:///path/to/something',
            },
            error: Error,
            message: /Only http: or https: are valid for scheme of GitHub API endpoint/,
        },
    ];

    for (const t of errorCases) {
        it(`throws an error when ${t.when}`, async function () {
            try {
                await validateGitHubToken(t.token, t.options);
                assert.ok(
                    false,
                    `Error did not occur for options: ${JSON.stringify(t.options)} (valid token=${
                        t.token === validToken
                    })`,
                );
            } catch (err) {
                assert.equal(err.name, t.error.name);
                assert.ok(err instanceof t.error, err);
                assert.ok(t.message.test(err.message), `Error message '${err.message}' did not match to ${t.message}`);
            }
        });
    }

    const actionToken = process.env.GITHUB_ACITON_TOKEN ?? '';
    if (actionToken !== '') {
        it('works with GitHub Action access token', async function () {
            const v = await validateGitHubToken(actionToken);
            assert.ok(v.rateLimit.remaining <= v.rateLimit.limit, JSON.stringify(v.rateLimit));
            assert.ok(v.scopes.length > 0, JSON.stringify(v.scopes));
        });
    }
});
