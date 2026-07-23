import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { productSchema } from '@tiny/shared';
import { api } from './api';
import { useMe } from './App';
import type { Product } from './types';

const won = (value: string | number) => `${Number(value).toLocaleString('ko-KR')}원`;

export function ProductList({
  search = false,
  mine = false,
}: {
  search?: boolean;
  mine?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const query = useQuery<{
    products: Product[];
    total?: number;
    page?: number;
    pageSize?: number;
  }>({
    queryKey: ['products', mine ? 'mine' : params.toString()],
    queryFn: () => api(mine ? '/products/mine' : `/products?${params.toString()}`),
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of data) if (String(value)) next.set(key, String(value));
    setParams(next);
  };
  const changePage = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    setParams(next);
  };
  return (
    <section>
      <h1>{mine ? '내 상품 관리' : search ? '상품 검색' : '전체 상품'}</h1>
      {!mine && (
        <form className="toolbar" onSubmit={submit}>
          <label className="field">
            검색어
            <input name="q" maxLength={100} defaultValue={params.get('q') ?? ''} />
          </label>
          <label className="field">
            최소 가격
            <input
              name="minPrice"
              type="number"
              min="0"
              defaultValue={params.get('minPrice') ?? ''}
            />
          </label>
          <label className="field">
            최대 가격
            <input
              name="maxPrice"
              type="number"
              min="0"
              defaultValue={params.get('maxPrice') ?? ''}
            />
          </label>
          <label className="field">
            상품 상태
            <select name="status" defaultValue={params.get('status') ?? 'ACTIVE'}>
              <option value="ACTIVE">판매 중</option>
              <option value="RESERVED">예약 중</option>
              <option value="SOLD">판매 완료</option>
            </select>
          </label>
          <label className="field">
            정렬
            <select name="sort" defaultValue={params.get('sort') ?? 'newest'}>
              <option value="newest">최신순</option>
              <option value="priceAsc">가격 낮은 순</option>
              <option value="priceDesc">가격 높은 순</option>
            </select>
          </label>
          <label className="field">
            페이지당 개수
            <select name="pageSize" defaultValue={params.get('pageSize') ?? '12'}>
              <option value="12">12개</option>
              <option value="24">24개</option>
              <option value="48">48개</option>
            </select>
          </label>
          <button type="submit">검색</button>
        </form>
      )}
      {query.isLoading && <p>상품을 불러오는 중…</p>}
      {query.error && <p className="error">{query.error.message}</p>}
      {query.data && (
        <>
          <p>검색 결과 {query.data.total ?? query.data.products.length}개</p>
          <div className="grid">
            {query.data.products.map((product) => (
              <Link key={product.id} className="card product-card" to={`/products/${product.id}`}>
                <img
                  src={`/uploads/${encodeURIComponent(product.imagePath)}`}
                  alt={`${product.name} 상품 사진`}
                />
                <h2>{product.name}</h2>
                <p className="price">{won(product.price)}</p>
                <span className="status">{product.status}</span>
                {mine && <p className="muted">상세 화면에서 수정할 수 있습니다.</p>}
              </Link>
            ))}
          </div>
          {query.data.products.length === 0 && (
            <p className="muted">조건에 맞는 상품이 없습니다.</p>
          )}
          {!mine &&
            (() => {
              const page = query.data.page ?? Number(params.get('page') ?? 1);
              const pageSize = query.data.pageSize ?? Number(params.get('pageSize') ?? 12);
              const totalPages = Math.max(1, Math.ceil((query.data.total ?? 0) / pageSize));
              return (
                <nav className="pagination" aria-label="상품 목록 페이지">
                  <button
                    className="secondary"
                    type="button"
                    disabled={page <= 1}
                    onClick={() => changePage(page - 1)}
                  >
                    이전
                  </button>
                  <span>
                    {page} / {totalPages} 페이지
                  </span>
                  <button
                    className="secondary"
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => changePage(page + 1)}
                  >
                    다음
                  </button>
                </nav>
              );
            })()}
        </>
      )}
    </section>
  );
}

export function ProductDetail() {
  const { id } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const client = useQueryClient();
  const query = useQuery<{ product: Product }>({
    queryKey: ['product', id],
    queryFn: () => api(`/products/${id}`),
    enabled: !!id,
  });
  const remove = useMutation({
    mutationFn: () => api(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['products'] });
      navigate('/my-products');
    },
  });
  if (query.isLoading) return <p>상품을 불러오는 중…</p>;
  if (query.error) return <p className="error">{query.error.message}</p>;
  const p = query.data!.product;
  const owner = me.data?.user?.id === p.sellerId || me.data?.user?.role === 'ADMIN';
  return (
    <article className="card">
      <div className="grid">
        <img
          className="product-detail-image"
          src={`/uploads/${encodeURIComponent(p.imagePath)}`}
          alt={`${p.name} 상품 사진`}
        />
        <div>
          <span className="status">{p.status}</span>
          <h1>{p.name}</h1>
          <p className="price">{won(p.price)}</p>
          <p className="product-description">{p.description}</p>
          {p.seller && (
            <p>
              판매자{' '}
              <Link to={`/users/${p.seller.id}`}>
                <strong>{p.seller.displayName}</strong> (@{p.seller.username})
              </Link>
            </p>
          )}
          <p className="muted">
            등록 {new Date(p.createdAt).toLocaleString('ko-KR')} · 수정{' '}
            {new Date(p.updatedAt).toLocaleString('ko-KR')}
          </p>
          <div className="actions">
            {owner ? (
              <>
                <Link className="button" to={`/products/${p.id}/edit`}>
                  수정
                </Link>
                <button
                  className="danger"
                  type="button"
                  onClick={() => {
                    if (confirm('상품을 삭제할까요?')) remove.mutate();
                  }}
                >
                  삭제
                </button>
              </>
            ) : (
              me.data?.user && (
                <>
                  <Link className="button" to={`/users/${p.sellerId}`}>
                    판매자에게 연락
                  </Link>
                  <Link className="button secondary" to={`/report?type=PRODUCT&targetId=${p.id}`}>
                    상품 신고
                  </Link>
                </>
              )
            )}
          </div>
          {remove.error && <p className="error">{remove.error.message}</p>}
        </div>
      </div>
    </article>
  );
}

type ProductInput = z.infer<typeof productSchema> & { image?: FileList };
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageBytes = 5 * 1024 * 1024;
const productFormSchema = productSchema.extend({
  image: z
    .any()
    .optional()
    .refine((files) => !files || files.length <= 1, '상품 이미지는 한 개만 선택해 주세요.')
    .refine((files) => {
      const file = files?.item?.(0) as File | null | undefined;
      return !file || allowedImageTypes.has(file.type);
    }, 'JPEG, PNG, WebP 이미지만 선택할 수 있습니다.')
    .refine((files) => {
      const file = files?.item?.(0) as File | null | undefined;
      return !file || file.size <= maxImageBytes;
    }, '상품 이미지는 5MB 이하여야 합니다.'),
});
export function ProductFormPage({ edit = false }: { edit?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useQuery<{ product: Product }>({
    queryKey: ['product', id],
    queryFn: () => api(`/products/${id}`),
    enabled: edit && !!id,
  });
  const form = useForm<ProductInput>({
    resolver: zodResolver(productFormSchema),
    values: query.data
      ? {
          name: query.data.product.name,
          description: query.data.product.description,
          price: Number(query.data.product.price),
          status: query.data.product.status as 'ACTIVE' | 'RESERVED' | 'SOLD',
        }
      : undefined,
  });
  const mutation = useMutation({
    mutationFn: async (v: ProductInput) => {
      const body = new FormData();
      body.set('name', v.name);
      body.set('description', v.description);
      body.set('price', String(v.price));
      if (v.status) body.set('status', v.status);
      const file = v.image?.item(0);
      if (file) body.set('image', file);
      if (!edit && !file) throw new Error('상품 이미지를 선택해 주세요.');
      return api(edit ? `/products/${id}` : '/products', { method: edit ? 'PUT' : 'POST', body });
    },
    onSuccess: (data) => navigate(`/products/${data.product.id}`),
  });
  return (
    <section>
      <h1>{edit ? '상품 수정' : '새 상품 등록'}</h1>
      {edit && query.isLoading ? (
        <p>불러오는 중…</p>
      ) : (
        <form className="form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
          <label className="field">
            상품명
            <input {...form.register('name')} />
            <span className="error">{form.formState.errors.name?.message}</span>
          </label>
          <label className="field">
            설명
            <textarea {...form.register('description')} />
            <span className="error">{form.formState.errors.description?.message}</span>
          </label>
          <label className="field">
            가격 (정수 KRW)
            <input
              type="number"
              min="1"
              step="1"
              {...form.register('price', { valueAsNumber: true })}
            />
            <span className="error">{form.formState.errors.price?.message}</span>
          </label>
          {edit && (
            <label className="field">
              판매 상태
              <select {...form.register('status')}>
                <option value="ACTIVE">판매 중</option>
                <option value="RESERVED">예약 중</option>
                <option value="SOLD">판매 완료</option>
              </select>
            </label>
          )}
          <label className="field">
            상품 사진 {edit && '(교체할 때만 선택)'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              {...form.register('image')}
            />
            <span className="error">{String(form.formState.errors.image?.message ?? '')}</span>
          </label>
          <p className="muted">
            JPEG, PNG, WebP · 최대 5MB · 서버에서 메타데이터 제거 후 재인코딩됩니다.
          </p>
          {mutation.error && (
            <p className="error" role="alert">
              {mutation.error.message}
            </p>
          )}
          <button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? '저장 중…' : '저장'}
          </button>
        </form>
      )}
    </section>
  );
}

export function ReportPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const type = params.get('type');
  const targetId = params.get('targetId');
  const form = useForm<{ reason: string }>({ defaultValues: { reason: '' } });
  const mutation = useMutation({
    mutationFn: (v: { reason: string }) =>
      api('/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: type,
          targetUserId: type === 'USER' ? targetId : undefined,
          targetProductId: type === 'PRODUCT' ? targetId : undefined,
          reason: v.reason,
        }),
      }),
    onSuccess: () => navigate(-1),
  });
  if (!['USER', 'PRODUCT'].includes(type ?? '') || !targetId)
    return <p className="error">신고 대상이 올바르지 않습니다.</p>;
  return (
    <section>
      <h1>{type === 'USER' ? '사용자' : '상품'} 신고</h1>
      <div className="notice">
        신고는 안전을 위한 기능입니다. 사실에 근거해 작성해 주세요. 동일 대상 중복 신고와 자기
        신고는 제한됩니다.
      </div>
      <form className="form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <label className="field">
          신고 사유 (10~1000자)
          <textarea minLength={10} maxLength={1000} required {...form.register('reason')} />
        </label>
        {mutation.error && <p className="error">{mutation.error.message}</p>}
        <button className="danger" type="submit">
          신고 제출
        </button>
      </form>
    </section>
  );
}
