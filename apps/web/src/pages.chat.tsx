import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api } from './api';
import { useMe } from './App';
import type { Message, Room, User } from './types';

export function ChatIndex() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const rooms = useQuery<{ rooms: Room[] }>({
    queryKey: ['rooms'],
    queryFn: () => api('/chats/rooms'),
  });
  const users = useQuery<{ users: User[] }>({
    queryKey: ['user-search', q],
    queryFn: () => api(`/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
  });
  const create = useMutation({
    mutationFn: (userId: string) =>
      api('/chats/direct', { method: 'POST', body: JSON.stringify({ userId }) }),
    onSuccess: (data) => navigate(`/chat/${data.room.id}`),
  });
  return (
    <section>
      <h1>채팅</h1>
      <div className="grid">
        <div className="card">
          <h2>채팅방</h2>
          {rooms.isLoading && <p>불러오는 중…</p>}
          {rooms.data?.rooms.map((room) => (
            <p key={room.id}>
              <Link className="button secondary" to={`/chat/${room.id}`}>
                {room.type === 'GLOBAL'
                  ? '전체 채팅'
                  : room.members?.map((m) => m.user.displayName).join(', ')}
              </Link>
            </p>
          ))}
        </div>
        <div className="card">
          <h2>새 1대1 채팅</h2>
          <label className="field">
            사용자 검색
            <input value={q} maxLength={30} onChange={(e) => setQ(e.target.value)} />
          </label>
          {users.data?.users.map((user) => (
            <p key={user.id}>
              <button className="secondary" type="button" onClick={() => create.mutate(user.id)}>
                {user.displayName} (@{user.username})
              </button>
            </p>
          ))}
          {create.error && <p className="error">{create.error.message}</p>}
        </div>
      </div>
    </section>
  );
}

export function ChatPage() {
  const { roomId } = useParams();
  const me = useMe();
  const client = useQueryClient();
  const [content, setContent] = useState('');
  const [socketError, setSocketError] = useState('');
  const socketRef = useRef<Socket>();
  const query = useQuery<{ messages: Message[] }>({
    queryKey: ['messages', roomId],
    queryFn: () => api(`/chats/${roomId}/messages`),
    enabled: !!roomId,
  });
  useEffect(() => {
    if (!roomId) return;
    const developmentUrl = import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:4000`
      : undefined;
    const socket = io(import.meta.env.VITE_SOCKET_URL ?? developmentUrl, { withCredentials: true });
    socketRef.current = socket;
    socket.on('connect', () =>
      socket.emit('room:join', roomId, (answer: { ok: boolean; message?: string }) => {
        if (answer.ok) setSocketError('');
        else setSocketError(answer.message ?? '참여할 수 없습니다.');
      }),
    );
    socket.on('connect_error', () =>
      setSocketError('실시간 연결에 실패했습니다. 재연결 중입니다.'),
    );
    socket.on('message:new', (message: Message) =>
      client.setQueryData<{ messages: Message[] }>(['messages', roomId], (old) => ({
        messages: [...(old?.messages ?? []), message],
      })),
    );
    return () => {
      socket.disconnect();
    };
  }, [roomId, client]);
  const send = (event: React.FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || !roomId) return;
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit(
        'message:send',
        { roomId, content: value },
        (answer: { ok: boolean; message?: string }) => {
          if (answer.ok) setContent('');
          else setSocketError(answer.message ?? '전송하지 못했습니다.');
        },
      );
      return;
    }
    void api<{ message: Message }>(`/chats/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: value }),
    })
      .then(({ message }) => {
        client.setQueryData<{ messages: Message[] }>(['messages', roomId], (old) => ({
          messages: [...(old?.messages ?? []), message],
        }));
        setContent('');
        setSocketError('실시간 연결이 복구 중이라 저장 방식으로 전송했습니다.');
      })
      .catch((error: Error) => setSocketError(error.message));
  };
  return (
    <section>
      <div className="actions">
        <h1>채팅방</h1>
        <Link className="button secondary" to="/chat">
          채팅 목록
        </Link>
      </div>
      {socketError && (
        <p role="alert" className="error">
          {socketError}
        </p>
      )}
      <div className="chat" aria-live="polite">
        {query.isLoading && <p>메시지를 불러오는 중…</p>}
        {query.error && <p className="error">{query.error.message}</p>}
        {query.data?.messages.map((message) => (
          <article
            key={message.id}
            className={`bubble ${message.senderId === me.data?.user?.id ? 'mine' : ''}`}
          >
            <strong>{message.sender.displayName}</strong>
            <p>{message.content}</p>
            <small>{new Date(message.createdAt).toLocaleString('ko-KR')}</small>
          </article>
        ))}
      </div>
      <form className="toolbar" onSubmit={send}>
        <label className="field" style={{ flex: 1 }}>
          메시지
          <input
            value={content}
            maxLength={500}
            required
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <button type="submit">전송</button>
      </form>
    </section>
  );
}
