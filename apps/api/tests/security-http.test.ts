import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { app } from '../src/app.js';
import { errorHandler } from '../src/http.js';

function mockResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

describe('오류 정보 노출과 보안 헤더', () => {
  it('Zod 필드 상세를 응답하지 않는다', () => {
    const result = z.object({ secretField: z.string().min(100) }).safeParse({
      secretField: 'short',
    });
    if (result.success) throw new Error('테스트 입력이 검증에 실패해야 합니다.');
    const response = mockResponse();

    errorHandler(result.error, { id: 'request-id' } as Request, response, vi.fn() as NextFunction);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: '입력값을 확인해 주세요.' },
      requestId: 'request-id',
    });
  });

  it('업로드 라이브러리의 내부 오류 문구를 일반화한다', () => {
    const response = mockResponse();

    errorHandler(
      new multer.MulterError('LIMIT_FILE_SIZE', 'internal-field-name'),
      { id: 'request-id' } as Request,
      response,
      vi.fn() as NextFunction,
    );

    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'UPLOAD_TOO_LARGE',
        message: '업로드 가능한 파일 크기를 초과했습니다.',
      },
      requestId: 'request-id',
    });
    expect(JSON.stringify(vi.mocked(response.json).mock.calls)).not.toContain(
      'internal-field-name',
    );
  });

  it('예상하지 못한 오류의 message와 stack을 로그·응답에서 제외한다', () => {
    const response = mockResponse();
    const logError = vi.fn();
    const internal = new Error('DATABASE_URL=postgresql://user:secret@internal/db');

    errorHandler(
      internal,
      { id: 'request-id', log: { error: logError } } as unknown as Request,
      response,
      vi.fn() as NextFunction,
    );

    expect(logError).toHaveBeenCalledWith(
      { errorName: 'Error', errorCode: undefined },
      'request failed',
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain('postgresql://');
    expect(response.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: '요청을 처리하지 못했습니다.' },
      requestId: 'request-id',
    });
  });

  it('잘못된 JSON과 알 수 없는 경로에 parser·서버 경로를 노출하지 않는다', async () => {
    const malformed = await request(app)
      .post('/api/auth/login')
      .set('content-type', 'application/json')
      .send('{"username":')
      .expect(400);
    expect(malformed.body).toMatchObject({
      error: { code: 'INVALID_JSON', message: '요청 본문 형식을 확인해 주세요.' },
    });
    expect(JSON.stringify(malformed.body)).not.toMatch(/SyntaxError|Unexpected token|stack/i);

    const missing = await request(app).get('/private/server/config').expect(404);
    expect(missing.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(JSON.stringify(missing.body)).not.toMatch(/\/home\/|node_modules|stack/i);
  });

  it('CSP에서 inline script와 inline style을 허용하지 않는다', async () => {
    const response = await request(app).get('/health').expect(200);
    const csp = response.headers['content-security-policy'] as string;
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
