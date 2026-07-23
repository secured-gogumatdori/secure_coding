import { Router } from 'express';
import { idSchema, productQuerySchema, productSchema } from '@tiny/shared';
import { prisma } from './db.js';
import {
  asyncHandler,
  HttpError,
  jsonBigInt,
  optionalActiveUser,
  parse,
  requireAuth,
} from './http.js';
import { removeImage, saveImage, upload } from './upload.js';

export const productsRouter = Router();
const sellerSelect = { id: true, username: true, displayName: true } as const;

productsRouter.get(
  '/',
  optionalActiveUser,
  asyncHandler(async (req, res) => {
    const query = parse(productQuerySchema, req.query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new HttpError(400, 'PRICE_RANGE_INVALID', '최소 가격은 최대 가격보다 클 수 없습니다.');
    const status = req.activeUser?.role === 'ADMIN' ? query.status : 'ACTIVE';
    const where = {
      status,
      price: {
        gte: query.minPrice === undefined ? undefined : BigInt(query.minPrice),
        lte: query.maxPrice === undefined ? undefined : BigInt(query.maxPrice),
      },
      OR: query.q
        ? [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            { description: { contains: query.q, mode: 'insensitive' as const } },
          ]
        : undefined,
    };
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { seller: { select: sellerSelect } },
        orderBy:
          query.sort === 'priceAsc'
            ? { price: 'asc' }
            : query.sort === 'priceDesc'
              ? { price: 'desc' }
              : { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
    res.json(jsonBigInt({ products, total, page, pageSize }));
  }),
);

productsRouter.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany({
      where: { sellerId: req.session.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(jsonBigInt({ products }));
  }),
);

productsRouter.get(
  '/:id',
  optionalActiveUser,
  asyncHandler(async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: { seller: { select: sellerSelect } },
    });
    if (!product || product.status === 'DELETED')
      throw new HttpError(404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.');
    const privileged = req.activeUser?.id === product.sellerId || req.activeUser?.role === 'ADMIN';
    if (product.status === 'HIDDEN' && !privileged)
      throw new HttpError(404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.');
    res.json(jsonBigInt({ product }));
  }),
);

productsRouter.post(
  '/',
  requireAuth,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const input = parse(productSchema, req.body);
    const imagePath = await saveImage(req.file);
    try {
      const product = await prisma.product.create({
        data: {
          sellerId: req.session.userId!,
          name: input.name,
          description: input.description,
          price: BigInt(input.price),
          imagePath,
        },
      });
      res.status(201).json(jsonBigInt({ product }));
    } catch (error) {
      await removeImage(imagePath);
      throw error;
    }
  }),
);

productsRouter.put(
  '/:id',
  requireAuth,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const input = parse(productSchema, req.body);
    const current = await prisma.product.findUnique({ where: { id } });
    if (!current || current.status === 'DELETED')
      throw new HttpError(404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.');
    if (current.sellerId !== req.session.userId && req.session.role !== 'ADMIN')
      throw new HttpError(403, 'OWNER_REQUIRED', '상품 소유자만 수정할 수 있습니다.');
    const imagePath = req.file ? await saveImage(req.file) : current.imagePath;
    try {
      const product = await prisma.product.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          price: BigInt(input.price),
          status: input.status,
          imagePath,
        },
      });
      if (req.file) await removeImage(current.imagePath);
      res.json(jsonBigInt({ product }));
    } catch (error) {
      if (req.file) await removeImage(imagePath);
      throw error;
    }
  }),
);

productsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.');
    if (product.sellerId !== req.session.userId && req.session.role !== 'ADMIN')
      throw new HttpError(403, 'OWNER_REQUIRED', '상품 소유자만 삭제할 수 있습니다.');
    await prisma.product.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: new Date() },
    });
    res.status(204).end();
  }),
);
