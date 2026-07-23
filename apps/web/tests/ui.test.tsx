import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { AuthPage } from '../src/pages.auth';
import { ProductFormPage, ProductList } from '../src/pages.products';
import { WalletPage } from '../src/pages.wallet';

function renderPage(node: React.ReactNode, path = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}
function response(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }),
  );
}
afterEach(() => vi.restoreAllMocks());

describe('폼 검증과 오류 표시', () => {
  it('로그인 폼이 잘못된 아이디와 빈 비밀번호를 거부한다', async () => {
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    renderPage(<AuthPage mode="login" />);
    fireEvent.change(screen.getByLabelText('아이디'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText(/Invalid|입력/i)).toBeInTheDocument();
    expect(mock).not.toHaveBeenCalled();
  });
  it('회원가입 폼이 약한 비밀번호를 거부한다', async () => {
    renderPage(<AuthPage mode="signup" />);
    await userEvent.type(screen.getByLabelText('아이디'), 'valid_user');
    await userEvent.type(screen.getByLabelText('표시 이름'), '테스터');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'short');
    await userEvent.click(screen.getByRole('button', { name: '가입하고 로그인' }));
    expect(await screen.findByText(/10/)).toBeInTheDocument();
  });
  it('로그인 API 오류를 사용자에게 표시한다', async () => {
    const mock = vi.fn((input: RequestInfo | URL) =>
      String(input).includes('/csrf')
        ? response({ csrfToken: 'token' })
        : response({ error: { message: '아이디 또는 비밀번호를 확인해 주세요.' } }, 401),
    );
    vi.stubGlobal('fetch', mock);
    renderPage(<AuthPage mode="login" />);
    await userEvent.type(screen.getByLabelText('아이디'), 'valid_user');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('아이디 또는 비밀번호');
  });
  it('상품 등록 폼이 빈 필드를 검증한다', async () => {
    renderPage(<ProductFormPage />);
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(
      await screen.findAllByText(/String must contain|Number must be greater/i),
    ).not.toHaveLength(0);
  });
});

describe('출력 인코딩', () => {
  it('저장된 HTML 형태의 상품명을 실행하지 않고 텍스트로 표시한다', async () => {
    const malicious = '<script>window.__xss = true</script>';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        response({
          products: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              sellerId: '00000000-0000-4000-8000-000000000002',
              name: malicious,
              description: '<img src=x onerror=alert(1)>',
              price: '1000',
              imagePath: 'safe.webp',
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          total: 1,
        }),
      ),
    );

    const view = renderPage(<ProductList />, '/products');

    expect(await screen.findByText(malicious)).toBeInTheDocument();
    expect(view.container.querySelector('script')).toBeNull();
    expect(view.container.querySelector('img[onerror]')).toBeNull();
  });
});

describe('권한 UI와 데모 지갑', () => {
  it('로그인 사용자의 시작하기 링크는 상품 목록으로 이동한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        response({
          user: {
            id: '1',
            username: 'member',
            displayName: '회원',
            bio: '',
            role: 'USER',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          },
        }),
      ),
    );
    renderPage(<App />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: '시작하기' })).toHaveAttribute('href', '/products'),
    );
  });

  it('관리자에게만 관리자 메뉴를 표시한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        response({
          user: {
            id: '1',
            username: 'admin',
            displayName: '관리자',
            bio: '',
            role: 'ADMIN',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          },
        }),
      ),
    );
    renderPage(<App />);
    expect(await screen.findByRole('link', { name: '관리자' })).toBeInTheDocument();
  });
  it('데모 경고와 송금 확인 화면을 표시한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/users/search'))
          return response({
            users: [
              {
                id: '00000000-0000-4000-8000-000000000010',
                username: 'target',
                displayName: '받는사람',
                bio: '',
                role: 'USER',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
              },
            ],
          });
        return response({ wallet: { balance: '100000' } });
      }),
    );
    renderPage(<WalletPage />);
    expect(await screen.findByText(/실제 화폐나 금융기관과 연결되지 않습니다/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('받는 사용자 검색'), '받는');
    await userEvent.click(await screen.findByRole('button', { name: /받는사람/ }));
    await userEvent.type(screen.getByLabelText('금액 (정수 KRW)'), '12000');
    await userEvent.click(screen.getByRole('button', { name: '송금 내용 확인' }));
    expect(screen.getByText(/12,000원/)).toBeInTheDocument();
  });
});
