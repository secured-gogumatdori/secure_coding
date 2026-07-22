import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { loginSchema, passwordChangeSchema, profileSchema, signupSchema } from '@tiny/shared';
import { api } from './api';
import { useMe } from './App';
import type { User } from './types';

type Login = z.infer<typeof loginSchema>;
type Signup = z.infer<typeof signupSchema>;

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  const schema = mode === 'login' ? loginSchema : signupSchema;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<any>({ resolver: zodResolver(schema) });
  const mutation = useMutation({
    mutationFn: async (value: Login | Signup) => {
      if (mode === 'signup') {
        await api('/auth/signup', { method: 'POST', body: JSON.stringify(value) });
        return api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: value.username, password: value.password }),
        });
      }
      return api('/auth/login', { method: 'POST', body: JSON.stringify(value) });
    },
    onSuccess: (data) => {
      client.setQueryData(['me'], { user: data.user });
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/') ? from : '/');
    },
  });
  return (
    <section>
      <h1>{mode === 'login' ? '로그인' : '회원가입'}</h1>
      <form className="form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <label className="field">
          아이디
          <input
            autoComplete="username"
            {...register('username')}
            aria-invalid={!!errors.username}
          />
          <span className="error">{String(errors.username?.message ?? '')}</span>
        </label>
        {mode === 'signup' && (
          <label className="field">
            표시 이름
            <input
              autoComplete="name"
              {...register('displayName')}
              aria-invalid={!!errors.displayName}
            />
            <span className="error">{String(errors.displayName?.message ?? '')}</span>
          </label>
        )}
        <label className="field">
          비밀번호
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            {...register('password')}
            aria-invalid={!!errors.password}
          />
          <span className="error">{String(errors.password?.message ?? '')}</span>
        </label>
        {mutation.error && (
          <p role="alert" className="error">
            {mutation.error.message}
          </p>
        )}
        <button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? '처리 중…' : mode === 'login' ? '로그인' : '가입하고 로그인'}
        </button>
        <p>
          {mode === 'login' ? (
            <Link to="/signup">계정 만들기</Link>
          ) : (
            <Link to="/login">이미 계정이 있습니다</Link>
          )}
        </p>
      </form>
    </section>
  );
}

export function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const query = useQuery<{ user: User }>({
    queryKey: ['user', id],
    queryFn: () => api(`/users/${id}`),
    enabled: !!id,
  });
  const chat = useMutation({
    mutationFn: () =>
      api('/chats/direct', { method: 'POST', body: JSON.stringify({ userId: id }) }),
    onSuccess: (data) => navigate(`/chat/${data.room.id}`),
  });
  if (query.isLoading) return <p>프로필을 불러오는 중…</p>;
  if (query.error) return <p className="error">{query.error.message}</p>;
  const user = query.data!.user;
  return (
    <article className="card">
      <h1>{user.displayName}</h1>
      <p>@{user.username}</p>
      <span className="status">{user.status}</span>
      <p>{user.bio || '아직 소개글이 없습니다.'}</p>
      <p className="muted">가입일 {new Date(user.createdAt).toLocaleDateString('ko-KR')}</p>
      {me.data?.user && me.data.user.id !== user.id && (
        <div className="actions">
          <button type="button" onClick={() => chat.mutate()}>
            1대1 채팅
          </button>
          <Link className="button secondary" to={`/report?type=USER&targetId=${user.id}`}>
            사용자 신고
          </Link>
        </div>
      )}
      {chat.error && <p className="error">{chat.error.message}</p>}
    </article>
  );
}

export function MyPage() {
  const me = useMe();
  const client = useQueryClient();
  const navigate = useNavigate();
  const profile = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { bio: me.data?.user?.bio ?? '' },
  });
  const password = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
  });
  const update = useMutation({
    mutationFn: (v: z.infer<typeof profileSchema>) =>
      api('/auth/me', { method: 'PATCH', body: JSON.stringify(v) }),
    onSuccess: (data) => client.setQueryData(['me'], { user: data.user }),
  });
  const change = useMutation({
    mutationFn: (v: z.infer<typeof passwordChangeSchema>) =>
      api('/auth/change-password', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: () => {
      client.setQueryData(['me'], { user: null });
      navigate('/login');
    },
  });
  return (
    <>
      <h1>마이페이지</h1>
      <div className="grid">
        <section className="form">
          <h2>프로필</h2>
          <p>
            <strong>{me.data?.user?.displayName}</strong> · @{me.data?.user?.username} ·{' '}
            <span className="status">{me.data?.user?.status}</span>
          </p>
          <form onSubmit={profile.handleSubmit((v) => update.mutate(v))}>
            <label className="field">
              소개글
              <textarea {...profile.register('bio')} />
              <span className="error">{profile.formState.errors.bio?.message}</span>
            </label>
            {update.error && <p className="error">{update.error.message}</p>}
            <button type="submit">소개글 저장</button>
          </form>
        </section>
        <section className="form">
          <h2>비밀번호 변경</h2>
          <p className="muted">변경하면 모든 로그인 세션이 종료됩니다.</p>
          <form onSubmit={password.handleSubmit((v) => change.mutate(v))}>
            <label className="field">
              현재 비밀번호
              <input
                type="password"
                autoComplete="current-password"
                {...password.register('currentPassword')}
              />
              <span className="error">{password.formState.errors.currentPassword?.message}</span>
            </label>
            <label className="field">
              새 비밀번호
              <input
                type="password"
                autoComplete="new-password"
                {...password.register('newPassword')}
              />
              <span className="error">{password.formState.errors.newPassword?.message}</span>
            </label>
            {change.error && <p className="error">{change.error.message}</p>}
            <button type="submit">비밀번호 변경</button>
          </form>
        </section>
      </div>
    </>
  );
}
