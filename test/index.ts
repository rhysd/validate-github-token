import { strict as assert } from 'assert';
import { validateGitHubToken, ValidateOptions } from '../index';

describe('validateGitHubToken()', function() {
    // Note: This token must have exact 'public_repo' and 'read:user' scopes
    let validToken: string;

    before(function() {
        if (!process.env.GITHUB_TOKEN) {
            throw new Error('$GITHUB_TOKEN environment variable is not set for testing');
        }
        validToken = process.env.GITHUB_TOKEN;
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
    ];

    for (const opts of normalCaseOptions) {
        it(`validates token with correct options '${JSON.stringify(opts)}'`, async function() {
            const v = await validateGitHubToken('rhysd', validToken, opts);
            assert.ok(v.rateLimit.remaining <= v.rateLimit.limit, JSON.stringify(v.rateLimit));
            assert.deepEqual(v.scopes, ['public_repo', 'read:user']);
            assert.ok(!v.scopes.includes('user'), JSON.stringify(v.scopes));
        });
    }
});
