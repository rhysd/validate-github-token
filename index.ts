import { Agent as HttpsAgent } from 'https';
import fetch, { Headers } from 'node-fetch';
import { URL } from 'url';

interface ScopeValidation {
    included?: string[];
    excluded?: string[];
}

export interface ValidateOptions {
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

function endpointUrl(userName: string, opts: ValidateOptions): string {
    try {
        const u = new URL(opts.endpointUrl || 'https://api.github.com');
        u.pathname = `/users/${userName}`;
        return u.href;
    } catch (err) {
        throw new Error(`Invalid URL for API endpoint: ${err.message}`);
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

    if (!xLimit || !xRemaining || !xReset) {
        throw new Error(`Response headers does not include rate limit information: ${JSON.stringify(headers.raw())}`);
    }

    return {
        limit: parseInt(xLimit, 10),
        remaining: parseInt(xRemaining, 10),
        reset: new Date(parseInt(xReset, 10) * 1000),
    };
}

function validateScopes(headers: Headers, validation: ScopeValidation | undefined): string[] {
    const header = headers.get('X-OAuth-Scopes');
    if (!header) {
        throw new Error(`Response headers does not include X-OAuth-Scopes: ${JSON.stringify(headers.raw())}`);
    }
    const scopes = header.split(',').map(s => s.trim());

    if (validation) {
        if (validation.included) {
            for (const scope of validation.included) {
                if (!scopes.includes(scope)) {
                    throw new Error(`Scope '${scope}' should be included in token scopes: ${header}`);
                }
            }
        }
        if (validation.excluded) {
            for (const scope of validation.excluded) {
                if (scopes.includes(scope)) {
                    throw new Error(`Scope '${scope}' should not be included in token scopes: ${header}`);
                }
            }
        }
    }

    return scopes;
}

export default async function validateGitHubToken(
    userName: string,
    token: string,
    opts?: ValidateOptions,
): Promise<Validated> {
    const o = opts ?? {};
    const url = endpointUrl(userName, o);
    const res = await request(url, token, o);

    if (!res.ok) {
        const body = await res.text();
        throw new Error(
            `Invalid GitHub API token with HTTP repsponse ${res.status} (${res.statusText}) and body '${body}'`,
        );
    }

    return {
        scopes: validateScopes(res.headers, o.scope),
        rateLimit: rateLimit(res.headers),
    };
}
