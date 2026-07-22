import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { api, resetCsrf } from './api';
import type { User } from './types';
import { AuthPage, MyPage, PublicProfile } from './pages.auth';
import { ProductDetail, ProductFormPage, ProductList, ReportPage } from './pages.products';
import { ChatIndex, ChatPage } from './pages.chat';
import { TransferHistory, WalletPage } from './pages.wallet';
import { AdminPage } from './pages.admin';

export function useMe() {
  return useQuery<{ user: User | null }>({ queryKey: ['me'], queryFn: () => api('/auth/me') });
}

function Layout() {
  const me = useMe();
  const queryClient = useQueryClient();
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    resetCsrf();
    queryClient.setQueryData(['me'], { user: null });
  };
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" to="/">
          Tiny Market
        </Link>
        <nav className="nav" aria-label="주 메뉴">
          <Link to="/products">상품</Link>
          <Link to="/search">검색</Link>
          {me.data?.user && (
            <>
              <Link to="/products/new">판매하기</Link>
              <Link to="/my-products">내 상품</Link>
              <Link to="/chat">채팅</Link>
              <Link to="/wallet">지갑</Link>
              <Link to="/me">마이페이지</Link>
            </>
          )}
          {me.data?.user?.role === 'ADMIN' && <Link to="/admin">관리자</Link>}
          {!me.data?.user ? (
            <>
              <Link to="/login">로그인</Link>
              <Link className="button" to="/signup">
                회원가입
              </Link>
            </>
          ) : (
            <button className="secondary" type="button" onClick={() => void logout()}>
              로그아웃
            </button>
          )}
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="footer">Tiny Market · 교육용 보안 프로젝트</footer>
    </div>
  );
}

function RequireAuth({ admin = false }: { admin?: boolean }) {
  const me = useMe();
  const location = useLocation();
  if (me.isLoading) return <p>사용자 정보를 확인하고 있습니다…</p>;
  if (!me.data?.user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (me.data.user.status !== 'ACTIVE' || (admin && me.data.user.role !== 'ADMIN'))
    return <Navigate to="/403" replace />;
  return <Outlet />;
}

function Home() {
  const me = useMe();

  return (
    <>
      <section className="hero">
        <span>SECURE BY DESIGN</span>
        <h1>
          작지만 안전한
          <br />
          중고거래
        </h1>
        <p>
          상품을 발견하고, 판매자와 실시간으로 대화하고, 교육용 데모 지갑으로 거래 흐름을
          경험하세요.
        </p>
        <div className="actions">
          <Link className="button" to="/products">
            상품 둘러보기
          </Link>
          <Link className="button secondary" to={me.data?.user ? '/products' : '/signup'}>
            시작하기
          </Link>
        </div>
      </section>
      <div className="notice">
        <strong>중요:</strong> 본 지갑은 교육용 데모 기능이며 실제 화폐나 금융기관과 연결되지
        않습니다.
      </div>
      <section>
        <h2>플랫폼 원칙</h2>
        <div className="grid">
          <article className="card">
            <h3>서버가 판단합니다</h3>
            <p>가격, 잔액, 권한, 사용자 식별을 브라우저 값에 맡기지 않습니다.</p>
          </article>
          <article className="card">
            <h3>개인 대화 보호</h3>
            <p>참여자만 1대1 채팅방에 들어갈 수 있습니다.</p>
          </article>
          <article className="card">
            <h3>신고 후 검토</h3>
            <p>자동 임시조치와 관리자 검토·복구를 함께 제공합니다.</p>
          </article>
        </div>
      </section>
    </>
  );
}

const Forbidden = () => (
  <section>
    <h1>403</h1>
    <p>이 페이지에 접근할 권한이 없습니다.</p>
    <Link className="button" to="/">
      홈으로
    </Link>
  </section>
);
const NotFound = () => (
  <section>
    <h1>404</h1>
    <p>요청한 페이지를 찾을 수 없습니다.</p>
    <Link className="button" to="/">
      홈으로
    </Link>
  </section>
);

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<AuthPage mode="signup" />} />
        <Route path="products" element={<ProductList />} />
        <Route path="search" element={<ProductList search />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="users/:id" element={<PublicProfile />} />
        <Route element={<RequireAuth />}>
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id/edit" element={<ProductFormPage edit />} />
          <Route path="my-products" element={<ProductList mine />} />
          <Route path="me" element={<MyPage />} />
          <Route path="chat" element={<ChatIndex />} />
          <Route path="chat/:roomId" element={<ChatPage />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="wallet/transfers" element={<TransferHistory />} />
        </Route>
        <Route element={<RequireAuth admin />}>
          <Route path="admin" element={<AdminPage kind="dashboard" />} />
          <Route path="admin/users" element={<AdminPage kind="users" />} />
          <Route path="admin/products" element={<AdminPage kind="products" />} />
          <Route path="admin/reports" element={<AdminPage kind="reports" />} />
          <Route path="admin/chat" element={<AdminPage kind="chat" />} />
          <Route path="admin/transfers" element={<AdminPage kind="transfers" />} />
        </Route>
        <Route path="403" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
