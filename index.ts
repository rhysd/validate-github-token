import { Agent as HttpsAgent } from 'https';
import fetch, { Headers } from 'node-fetch';
import { URL } from 'url';

interface ScopeValidation {
    included?: string[];
    excluded?: string[];
    exact?: string[];
}

export interface ValidateOptions {
    userName?: string;
    scope?: ScopeValidation;
    agent?: HttpsAgent;
    endpointUrl?: string;
}

export interface RateLimit {
    limit: number;
    remaining: number;
    reset: Date;
}

export interface Validated {
    scopes: string[];
    rateLimit: RateLimit;
}

export class ValidationError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = 'ValidationError';
    }
}

function errorMessage(e: unknown): string {
    if (e instanceof Error) {
        return e.message;
    }
    return `${e}`;
}

function endpointUrl(opts: ValidateOptions): string {
    const s = opts.endpointUrl ?? 'https://api.github.com';
    try {
        const u = new URL(s);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            throw new Error('Only http: or https: are valid for scheme of GitHub API endpoint');
        }
        if (opts.userName) {
            u.pathname = `/users/${opts.userName}`;
        }
        return u.href;
    } catch (err) {
        throw new Error(`Invalid URL ${s} for API endpoint: ${errorMessage(err)}`);
    }
}

async function request(url: string, token: string, opts: ValidateOptions) {
    try {
        return await fetch(url, {
            headers: {
                Authorization: `token ${token}`,
            },
            agent: opts.agent,
        });
    } catch (err) {
        throw new Error(`Could not send a validation request to ${url}`);
    }
}

function rateLimit(headers: Headers): RateLimit {
    const xLimit = headers.get('X-RateLimit-Limit');
    const xRemaining = headers.get('X-RateLimit-Remaining');
    const xReset = headers.get('X-RateLimit-Reset');

    if (xLimit === null || xRemaining === null || xReset === null) {
        throw new Error(`Response headers don't include rate limit information: ${JSON.stringify(headers.raw())}`);
    }

    return {
        limit: parseInt(xLimit, 10),
        remaining: parseInt(xRemaining, 10),
        reset: new Date(parseInt(xReset, 10) * 1000),
    };
}

function validateScopes(headers: Headers, validation: ScopeValidation | undefined): string[] {
    const header = headers.get('X-OAuth-Scopes');
    if (header === null) {
        throw new Error(`Response headers don't include X-OAuth-Scopes: ${JSON.stringify(headers.raw())}`);
    }
    const scopes = header
        .split(',')
        .map((s) => s.trim())
        .filter((s) => !!s);

    if (validation) {
        if (validation.included) {
            for (const scope of validation.included) {
                if (!scopes.includes(scope)) {
                    throw new ValidationError(`Scope '${scope}' should be included in token scopes: ${header}`);
                }
            }
        }
        if (validation.excluded) {
            for (const scope of validation.excluded) {
                if (scopes.includes(scope)) {
                    throw new ValidationError(`Scope '${scope}' should not be included in token scopes: ${header}`);
                }
            }
        }
        if (validation.exact) {
            const want = validation.exact;
            if (want.some((s) => !scopes.includes(s)) || scopes.some((s) => !want.includes(s))) {
                const got = JSON.stringify(scopes);
                const expected = JSON.stringify(want);
                throw new ValidationError(
                    `The token's scopes ${got} don't exactly match to the expected scopes ${expected}`,
                );
            }
        }
    }

    return scopes;
}

export async function validateGitHubToken(token: string, opts: ValidateOptions = {}): Promise<Validated> {
    const url = endpointUrl(opts);
    const res = await request(url, token, opts);

    if (!res.ok) {
        const body = await res.text();
        if (res.status === 401) {
            throw new ValidationError(`Unauthorized GitHub API token. Response: '${body}', URL: ${url}`);
        }
        throw new Error(
            `Unexpected HTTP request failure with response ${res.status} (${res.statusText}) and body '${body}'`,
        );
    }

    return {
        scopes: validateScopes(res.headers, opts.scope),
        rateLimit: rateLimit(res.headers),
    };
}
