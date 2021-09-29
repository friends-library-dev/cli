import '@friends-library/env/load';
import fetch from 'node-fetch';
import { Result } from 'x-ts-utils';
import env from '@friends-library/env';

interface GraphQLError {
  statusCode: number | undefined;
  messages: string[];
  body: string;
}

export async function send<T = Record<string, any>>(
  operation: string,
  variables?: Record<string, unknown>,
): Promise<Result<T, GraphQLError>> {
  const ENDPOINT = env.requireVar(`CLI_FLP_API_ENDPOINT`);
  const TOKEN = env.requireVar(`CLI_FLP_API_TOKEN`);

  try {
    const res = await fetch(ENDPOINT, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`,
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        query: operation,
        ...(variables ? { variables } : {}),
      }),
    });

    const body = await res.text();
    let json: null | Record<string, any> = null;
    try {
      json = JSON.parse(body);
    } catch {
      // ¯\_(ツ)_/¯
    }

    if (res.status !== 200 || !json || `errors` in json || `data` in json === false) {
      return {
        success: false,
        error: {
          statusCode: res.status,
          messages: getErrors(json, body),
          body,
        },
      };
    }

    return {
      success: true,
      value: json.data as T,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: {
        statusCode: -1,
        messages: [`Unexpected error`],
        body: `<no body>`,
      },
    };
  }
}

function getErrors(json: null | Record<string, any>, text: string): string[] {
  if (json && Array.isArray(json.errors)) {
    return json.errors.map((e) => e.message);
  }
  return [text];
}
