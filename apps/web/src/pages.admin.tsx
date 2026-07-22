import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from './api';

type Kind = 'dashboard' | 'users' | 'products' | 'reports' | 'chat' | 'transfers';
const won = (value: string) => `${Number(value).toLocaleString('ko-KR')}원`;

function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="관리 메뉴">
      <Link className="button secondary" to="/admin">
        대시보드
      </Link>
      <Link className="button secondary" to="/admin/users">
        사용자
      </Link>
      <Link className="button secondary" to="/admin/products">
        상품
      </Link>
      <Link className="button secondary" to="/admin/reports">
        신고
      </Link>
      <Link className="button secondary" to="/admin/chat">
        채팅
      </Link>
      <Link className="button secondary" to="/admin/transfers">
        송금
      </Link>
    </nav>
  );
}

export function AdminPage({ kind }: { kind: Kind }) {
  return (
    <section>
      <h1>관리자 {kind === 'dashboard' ? '대시보드' : '관리'}</h1>
      <div className="notice">
        관리 작업은 감사 로그에 기록됩니다. 대상과 영향을 확인한 뒤 실행하세요.
      </div>
      <AdminNav />
      <AdminContent kind={kind} />
    </section>
  );
}

function AdminContent({ kind }: { kind: Kind }) {
  const client = useQueryClient();
  const path =
    kind === 'dashboard' ? '/admin/stats' : `/admin/${kind === 'chat' ? 'messages' : kind}`;
  const query = useQuery<any>({ queryKey: ['admin', kind], queryFn: () => api(path) });
  const mutate = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      api(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] });
    },
  });
  const audit = useQuery<any>({
    queryKey: ['admin', 'audits'],
    queryFn: () => api('/admin/audit-logs'),
    enabled: kind === 'dashboard',
  });
  if (query.isLoading) return <p>관리 데이터를 불러오는 중…</p>;
  if (query.error) return <p className="error">{query.error.message}</p>;
  if (kind === 'dashboard') {
    const s = query.data;
    return (
      <>
        <div className="grid">
          <Stat label="사용자 수" value={s.users} />
          <Stat label="상품 수" value={s.products} />
          <Stat label="활성 상품" value={s.activeProducts} />
          <Stat label="미처리 신고" value={s.pendingReports} />
          <Stat label="송금 건수" value={s.transfers} />
        </div>
        <h2>최근 감사 로그</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>시각</th>
                <th>관리자</th>
                <th>작업</th>
                <th>대상</th>
              </tr>
            </thead>
            <tbody>
              {audit.data?.logs.map((l: any) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleString('ko-KR')}</td>
                  <td>{l.admin.username}</td>
                  <td>{l.action}</td>
                  <td>
                    {l.targetType} · {l.targetId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  if (kind === 'users')
    return (
      <Table
        headers={['아이디', '표시 이름', '상태', '가입일', '변경']}
        rows={query.data.users.map((u: any) => [
          u.username,
          u.displayName,
          u.status,
          new Date(u.createdAt).toLocaleDateString('ko-KR'),
          <select
            key={u.id}
            aria-label={`${u.username} 상태 변경`}
            defaultValue={u.status}
            onChange={(e) => {
              if (confirm(`${u.username} 계정 상태를 ${e.target.value}(으)로 변경할까요?`))
                mutate.mutate({
                  path: `/admin/users/${u.id}/status`,
                  body: { status: e.target.value },
                });
            }}
          >
            <option>ACTIVE</option>
            <option>DORMANT</option>
            <option>BANNED</option>
          </select>,
        ])}
      />
    );
  if (kind === 'products')
    return (
      <Table
        headers={['상품', '판매자', '가격', '상태', '변경']}
        rows={query.data.products.map((p: any) => [
          p.name,
          p.seller.username,
          won(p.price),
          p.status,
          <select
            key={p.id}
            aria-label={`${p.name} 상태 변경`}
            defaultValue={p.status}
            onChange={(e) => {
              if (confirm(`${p.name} 상품 상태를 ${e.target.value}(으)로 변경할까요?`))
                mutate.mutate({
                  path: `/admin/products/${p.id}/status`,
                  body: { status: e.target.value },
                });
            }}
          >
            <option>ACTIVE</option>
            <option>RESERVED</option>
            <option>SOLD</option>
            <option>HIDDEN</option>
            <option>DELETED</option>
          </select>,
        ])}
      />
    );
  if (kind === 'reports')
    return (
      <Table
        headers={['신고자', '대상', '사유', '상태', '검토']}
        rows={query.data.reports.map((r: any) => [
          r.reporter.username,
          r.targetUser?.username ?? r.targetProduct?.name,
          r.reason,
          r.status,
          r.status === 'PENDING' ? (
            <div key={r.id} className="actions">
              <button
                type="button"
                onClick={() =>
                  mutate.mutate({
                    path: `/admin/reports/${r.id}/review`,
                    body: { decision: 'APPROVE', restoreTarget: false },
                  })
                }
              >
                승인
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  mutate.mutate({
                    path: `/admin/reports/${r.id}/review`,
                    body: { decision: 'REJECT', restoreTarget: true },
                  })
                }
              >
                기각·복구
              </button>
            </div>
          ) : (
            '완료'
          ),
        ])}
      />
    );
  if (kind === 'chat')
    return (
      <Table
        headers={['시각', '보낸 사용자', '방', '내용', '상태/작업']}
        rows={query.data.messages.map((m: any) => [
          new Date(m.createdAt).toLocaleString('ko-KR'),
          m.sender.username,
          m.chatRoom.type,
          m.content,
          m.status === 'VISIBLE' ? (
            <button
              className="danger"
              key={m.id}
              type="button"
              onClick={() => mutate.mutate({ path: `/admin/messages/${m.id}/hide` })}
            >
              숨김
            </button>
          ) : (
            m.status
          ),
        ])}
      />
    );
  return (
    <Table
      headers={['일시', '보낸 사용자', '받은 사용자', '금액', '상태']}
      rows={query.data.transfers.map((t: any) => [
        new Date(t.createdAt).toLocaleString('ko-KR'),
        t.sender.username,
        t.receiver.username,
        won(t.amount),
        t.status,
      ])}
    />
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className="card">
      <h2>{label}</h2>
      <p className="stat">{value.toLocaleString('ko-KR')}</p>
    </article>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
