import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from './api';
import { createClientId } from './client-id';
import type { UserSummary } from './types';

const warning = (
  <div className="notice">
    <strong>본 지갑은 교육용 데모 기능이며 실제 화폐나 금융기관과 연결되지 않습니다.</strong>
  </div>
);
const won = (value: string) => `${Number(value).toLocaleString('ko-KR')}원`;
interface Transfer {
  id: string;
  amount: string;
  createdAt: string;
  sender: { id: string; displayName: string; username: string };
  receiver: { id: string; displayName: string; username: string };
}

export function WalletPage() {
  const client = useQueryClient();
  const [q, setQ] = useState('');
  const [receiver, setReceiver] = useState<UserSummary | null>(null);
  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const wallet = useQuery<{ wallet: { balance: string } }>({
    queryKey: ['wallet'],
    queryFn: () => api('/wallet'),
  });
  const users = useQuery<{ users: UserSummary[] }>({
    queryKey: ['user-search', q],
    queryFn: () => api(`/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
  });
  const transfer = useMutation({
    mutationFn: () => {
      if (!receiver || !idempotencyKey) throw new Error('송금 내용을 다시 확인해 주세요.');
      return api('/wallet/transfers', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: receiver.id,
          amount: Number(amount),
          idempotencyKey,
        }),
      });
    },
    onSuccess: () => {
      setConfirming(false);
      setIdempotencyKey(null);
      setAmount('');
      setReceiver(null);
      void client.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
  return (
    <section>
      <h1>데모 지갑</h1>
      {warning}
      <div className="grid">
        <article className="card">
          <h2>현재 잔액</h2>
          <p className="stat">{wallet.data ? won(wallet.data.wallet.balance) : '…'}</p>
          <Link className="button secondary" to="/wallet/transfers">
            송금 내역
          </Link>
        </article>
        <article className="form">
          <h2>송금</h2>
          {!receiver ? (
            <>
              <label className="field">
                받는 사용자 검색
                <input value={q} maxLength={30} onChange={(e) => setQ(e.target.value)} />
              </label>
              {users.data?.users.map((user) => (
                <p key={user.id}>
                  <button className="secondary" type="button" onClick={() => setReceiver(user)}>
                    {user.displayName} (@{user.username})
                  </button>
                </p>
              ))}
            </>
          ) : (
            <>
              <p>
                받는 분: <strong>{receiver.displayName}</strong> (@{receiver.username})
              </p>
              <label className="field">
                금액 (정수 KRW)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setConfirming(false);
                    setIdempotencyKey(null);
                  }}
                />
              </label>
              {!confirming ? (
                <button
                  type="button"
                  disabled={!Number.isInteger(Number(amount)) || Number(amount) <= 0}
                  onClick={() => {
                    setIdempotencyKey(createClientId());
                    setConfirming(true);
                  }}
                >
                  송금 내용 확인
                </button>
              ) : (
                <div className="notice">
                  <p>
                    <strong>{receiver.displayName}</strong>님에게{' '}
                    <strong>{Number(amount).toLocaleString('ko-KR')}원</strong>을 보냅니다.
                  </p>
                  <div className="actions">
                    <button
                      type="button"
                      disabled={transfer.isPending}
                      onClick={() => transfer.mutate()}
                    >
                      확인하고 송금
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => {
                        setConfirming(false);
                        setIdempotencyKey(null);
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
              <p>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setReceiver(null);
                    setConfirming(false);
                    setIdempotencyKey(null);
                  }}
                >
                  받는 분 변경
                </button>
              </p>
            </>
          )}
          {transfer.error && <p className="error">{transfer.error.message}</p>}
          {transfer.isSuccess && <p className="success">송금이 완료되었습니다.</p>}
        </article>
      </div>
    </section>
  );
}

export function TransferHistory() {
  const query = useQuery<{ transfers: Transfer[] }>({
    queryKey: ['transfers'],
    queryFn: () => api('/wallet/transfers'),
  });
  return (
    <section>
      <h1>송금 내역</h1>
      {warning}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>일시</th>
              <th>보낸 사용자</th>
              <th>받은 사용자</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.transfers.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.createdAt).toLocaleString('ko-KR')}</td>
                <td>{t.sender.displayName}</td>
                <td>{t.receiver.displayName}</td>
                <td>{won(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.isLoading && <p>내역을 불러오는 중…</p>}
      {query.error && <p className="error">{query.error.message}</p>}
    </section>
  );
}
