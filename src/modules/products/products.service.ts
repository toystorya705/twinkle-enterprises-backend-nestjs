import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeProductStatus, normalizeUnit } from '../../shared/utils/enum-normalizers';
import { slugify } from '../../shared/utils/slugify';
import { BulkProductActionDto } from './dto/bulk-product-action.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InventoryService } from './inventory.service';
import { SkuService } from './sku.service';

const productInclude = {
  Category: true,
  Variant: true,
  Specification: true,
  ProductImage: true,
  ProductVideo: true,
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly skus: SkuService,
    private readonly config: ConfigService,
  ) {}

  async findAll(options: { includeDeleted?: boolean } = {}) {
    const products = await this.prisma.product.findMany({
      where: options.includeDeleted ? undefined : { status: { not: ProductStatus.DELETED } },
      include: productInclude,
      orderBy: { createdAt: 'desc' },
    });
    return products.map((product) => this.toFrontendProduct(product));
  }

  async findOne(idOrSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.toFrontendProduct(product);
  }

  async create(dto: CreateProductDto) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const sku = dto.sku?.trim() || await this.skus.nextProductSku(dto.name);
    const categoryId = await this.resolveCategoryId(dto.categoryId, dto.category);
    const hasVariants = !!dto.variants?.length;
    this.assertValidInventory(dto.unit, hasVariants ? undefined : dto.stockQuantity);
    this.assertValidVariantInventory(dto.variants);
    await this.assertSkuAvailability(sku, dto.variants);
    const product = await this.prisma.transaction(async (tx) => {
      const productId = randomUUID();
      const now = new Date();
      await tx.product.create({
        data: {
          id: productId,
          name: dto.name,
          slug,
          sku,
          brand: dto.brand,
          description: dto.fullDescription ?? dto.shortDescription,
          shortDescription: dto.shortDescription ?? '',
          fullDescription: dto.fullDescription ?? dto.shortDescription ?? '',
          price: dto.price ?? 0,
          unit: normalizeUnit(dto.unit),
          stockQuantity: hasVariants ? null : dto.stockQuantity ?? 0,
          lowStockThreshold: dto.lowStockThreshold ?? 5,
          customUnit: dto.customUnit,
          status: normalizeProductStatus(dto.status ?? (dto.isActive === false ? 'inactive' : 'active')),
          categoryId,
          rating: dto.rating ?? 0,
          buyEnabled: dto.buyEnabled ?? true,
          isActive: dto.isActive ?? true,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          seoKeywords: dto.seoKeywords ?? [],
          createdAt: now,
          updatedAt: now,
        },
      });

      await this.createProductRelations(tx, productId, dto, sku);
      const created = await tx.product.findUnique({
        where: { id: productId },
        include: productInclude,
      });

      if (!created) {
        throw new NotFoundException('Product not found after creation');
      }

      return created;
    });

    return this.toFrontendProduct(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    const current = await this.ensureExists(id);
    const categoryId = await this.resolveCategoryId(dto.categoryId, dto.category);
    const hasVariants = !!dto.variants?.length;
    const status = dto.status ? normalizeProductStatus(dto.status) : undefined;
    const productSku = dto.sku?.trim() || current.sku;
    this.assertValidInventory(dto.unit ?? current.unit, dto.variants ? (hasVariants ? undefined : dto.stockQuantity) : dto.stockQuantity);
    this.assertValidVariantInventory(dto.variants);
    await this.assertSkuAvailability(productSku, dto.variants, id);
    const data: Prisma.ProductUpdateInput = {
      name: dto.name,
      slug: dto.slug ? slugify(dto.slug) : undefined,
      sku: dto.sku?.trim(),
      brand: dto.brand,
      description: dto.fullDescription ?? dto.shortDescription,
      shortDescription: dto.shortDescription,
      fullDescription: dto.fullDescription,
      price: dto.price,
      unit: dto.unit ? normalizeUnit(dto.unit) : undefined,
      stockQuantity: dto.variants ? (hasVariants ? null : dto.stockQuantity ?? 0) : dto.stockQuantity,
      lowStockThreshold: dto.lowStockThreshold,
      customUnit: dto.customUnit,
      status,
      Category: categoryId
        ? { connect: { id: categoryId } }
        : dto.categoryId === null || dto.category === null
          ? { disconnect: true }
          : undefined,
      rating: dto.rating,
      buyEnabled: dto.buyEnabled,
      isActive: dto.isActive ?? (status ? status === ProductStatus.ACTIVE : undefined),
      seoTitle: dto.seoTitle,
      seoDescription: dto.seoDescription,
      seoKeywords: dto.seoKeywords,
    };

    const product = await this.prisma.transaction(async (tx) => {
      if (dto.variants) {
        await tx.variant.deleteMany({ where: { productId: id } });
      }
      if (dto.specifications) {
        await tx.specification.deleteMany({ where: { productId: id } });
      }
      if (dto.images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
      }
      if (dto.videos) {
        await tx.productVideo.deleteMany({ where: { productId: id } });
      }

      return tx.product.update({
        where: { id },
        data: {
          ...data,
          Variant: this.variantWrites(dto.variants, productSku),
          Specification: this.specificationWrites(dto.specifications),
          ProductImage: this.imageWrites(dto.images),
          ProductVideo: this.videoWrites(dto.videos),
        },
        include: productInclude,
      });
    });

    return this.toFrontendProduct(product);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.assertNotReferenced([id]);
    await this.prisma.product.update({
      where: { id },
      data: {
        status: ProductStatus.DELETED,
        isActive: false,
        buyEnabled: false,
      },
    });
    return { id, deleted: true, softDeleted: true };
  }

  async nextSku(name?: string) {
    return { sku: await this.skus.nextProductSku(name) };
  }

  async updateStatus(id: string, statusValue: string) {
    await this.ensureExists(id);
    const status = normalizeProductStatus(statusValue);
    const product = await this.prisma.product.update({
      where: { id },
      data: this.statusData(status),
      include: productInclude,
    });
    return this.toFrontendProduct(product);
  }

  async bulkAction(dto: BulkProductActionDto) {
    const ids = [...new Set(dto.ids)].filter(Boolean);
    if (!ids.length) {
      return { updated: 0, ids: [] };
    }

    if (dto.action === 'softDelete') {
      await this.assertNotReferenced(ids);
    }

    const status = this.statusForBulkAction(dto);
    const result = await this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: this.statusData(status),
    });

    return { updated: result.count, ids, status: status.toLowerCase() };
  }

  private async ensureExists(id: string): Promise<{ id: string; sku: string; unit: string }> {
    const exists = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, sku: true, unit: true },
    });

    if (!exists) {
      throw new NotFoundException('Product not found');
    }

    return exists;
  }

  private async resolveCategoryId(
    categoryId?: string | null,
    categorySlug?: string | null,
  ): Promise<string | null | undefined> {
    if (categoryId !== undefined) {
      return categoryId;
    }

    if (categorySlug === null) {
      return null;
    }

    if (!categorySlug) {
      return null;
    }

    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
      select: { id: true },
    });

    return category?.id;
  }

  private async assertNotReferenced(ids: string[]) {
    const [invoiceCount, quotationCount] = await this.prisma.$transaction([
      this.prisma.invoiceItem.count({ where: { productId: { in: ids } } }),
      this.prisma.quotationItem.count({ where: { productId: { in: ids } } }),
    ]);

    if (invoiceCount || quotationCount) {
      throw new BadRequestException(
        'This product cannot be deleted because it is referenced in one or more quotations or invoices. Archive it instead.',
      );
    }
  }

  private statusForBulkAction(dto: BulkProductActionDto): ProductStatus {
    switch (dto.action) {
      case 'activate':
      case 'restore':
        return ProductStatus.ACTIVE;
      case 'deactivate':
        return ProductStatus.INACTIVE;
      case 'archive':
        return ProductStatus.ARCHIVED;
      case 'softDelete':
        return ProductStatus.DELETED;
      case 'changeStatus':
        return normalizeProductStatus(dto.status);
      default:
        return ProductStatus.ACTIVE;
    }
  }

  private statusData(status: ProductStatus): Prisma.ProductUpdateManyMutationInput {
    return {
      status,
      isActive: status === ProductStatus.ACTIVE,
      buyEnabled: status === ProductStatus.ACTIVE ? undefined : false,
    };
  }

  private async createProductRelations(
    tx: Prisma.TransactionClient,
    productId: string,
    dto: CreateProductDto,
    sku: string,
  ): Promise<void> {
    const variants = this.variantRows(dto.variants, sku, productId);
    const specifications = this.specificationRows(dto.specifications, productId);
    const images = this.imageRows(dto.images, productId);
    const videos = this.videoRows(dto.videos, productId);

    if (variants.length) await tx.variant.createMany({ data: variants });
    if (specifications.length) await tx.specification.createMany({ data: specifications });
    if (images.length) await tx.productImage.createMany({ data: images });
    if (videos.length) await tx.productVideo.createMany({ data: videos });
  }

  private variantWrites(variants?: CreateProductDto['variants'], productSku?: string) {
    if (!variants?.length) {
      return undefined;
    }

    return {
      create: variants.map((variant, index) => ({
        id: randomUUID(),
        name: variant.name ?? variant.label ?? 'Default',
        sku: variant.sku?.trim() || (productSku ? this.skus.suggestVariantSku(productSku, variant.name ?? variant.label, index + 1) : undefined),
        price: variant.price,
        stockQuantity: variant.stockQuantity ?? 0,
        lowStockThreshold: variant.lowStockThreshold ?? 5,
        unit: variant.unit ? normalizeUnit(variant.unit) : undefined,
        customUnit: variant.customUnit,
        imageUrls: variant.imageUrls?.length
          ? variant.imageUrls.map((url) => this.normalizeMediaPath(url)).filter((url): url is string => !!url)
          : variant.imageUrl
            ? [this.normalizeMediaPath(variant.imageUrl)].filter((url): url is string => !!url)
            : [],
        sortOrder: index,
        updatedAt: new Date(),
      })),
    };
  }

  private variantRows(
    variants: CreateProductDto['variants'],
    productSku: string,
    productId: string,
  ): Prisma.VariantCreateManyInput[] {
    return (variants ?? []).map((variant, index) => ({
      id: randomUUID(),
      productId,
      name: variant.name ?? variant.label ?? 'Default',
      sku: variant.sku?.trim() || this.skus.suggestVariantSku(productSku, variant.name ?? variant.label, index + 1),
      price: variant.price,
      stockQuantity: variant.stockQuantity ?? 0,
      lowStockThreshold: variant.lowStockThreshold ?? 5,
      unit: variant.unit ? normalizeUnit(variant.unit) : undefined,
      customUnit: variant.customUnit,
      imageUrls: variant.imageUrls?.length
        ? variant.imageUrls.map((url) => this.normalizeMediaPath(url)).filter((url): url is string => !!url)
        : variant.imageUrl
          ? [this.normalizeMediaPath(variant.imageUrl)].filter((url): url is string => !!url)
          : [],
      sortOrder: index,
      updatedAt: new Date(),
    }));
  }

  private async assertSkuAvailability(
    productSku: string,
    variants?: CreateProductDto['variants'],
    productId?: string,
  ) {
    const variantSkus = (variants ?? [])
      .map((variant, index) => variant.sku?.trim() || this.skus.suggestVariantSku(productSku, variant.name ?? variant.label, index + 1))
      .filter(Boolean);
    const normalized = [productSku, ...variantSkus].map((sku) => sku.toUpperCase());
    const duplicates = normalized.filter((sku, index) => normalized.indexOf(sku) !== index);
    if (duplicates.length) {
      throw new BadRequestException(`Duplicate SKU in request: ${duplicates[0]}`);
    }

    const productConflict = await this.prisma.product.findFirst({
      where: {
        sku: { in: [productSku, ...variantSkus] },
        ...(productId ? { id: { not: productId } } : {}),
      },
      select: { sku: true },
    });
    if (productConflict) {
      throw new BadRequestException(`SKU already exists: ${productConflict.sku}`);
    }

    if (!normalized.length) {
      return;
    }

    const variantConflict = await this.prisma.variant.findFirst({
      where: {
        sku: { in: [productSku, ...variantSkus] },
        ...(productId ? { productId: { not: productId } } : {}),
      },
      select: { sku: true },
    });
    if (variantConflict?.sku) {
      throw new BadRequestException(`SKU already exists: ${variantConflict.sku}`);
    }
  }

  private assertValidInventory(unit?: string | null, quantity?: number | null) {
    if (quantity === undefined || quantity === null) {
      return;
    }

    if (normalizeUnit(unit) === 'PCS' && !Number.isInteger(quantity)) {
      throw new BadRequestException('PCS inventory quantities must be whole numbers.');
    }
  }

  private assertValidVariantInventory(variants?: CreateProductDto['variants']) {
    variants?.forEach((variant) => this.assertValidInventory(variant.unit, variant.stockQuantity));
  }

  private specificationWrites(specifications?: Record<string, unknown>) {
    if (!specifications) {
      return undefined;
    }

    return {
      create: Object.entries(specifications).map(([key, value]) => ({
        id: randomUUID(),
        key,
        value: String(value),
      })),
    };
  }

  private specificationRows(
    specifications: Record<string, unknown> | undefined,
    productId: string,
  ): Prisma.SpecificationCreateManyInput[] {
    return Object.entries(specifications ?? {}).map(([key, value]) => ({
      id: randomUUID(),
      productId,
      key,
      value: String(value),
    }));
  }

  private imageWrites(images?: CreateProductDto['images']) {
    const rows: Prisma.ProductImageCreateWithoutProductInput[] = [];
    for (const [index, image] of (images ?? []).entries()) {
      if (typeof image === 'string') {
        const url = this.normalizeMediaPath(image);
        if (url) rows.push({ id: randomUUID(), url, sortOrder: index, isPrimary: index === 0 });
        continue;
      }

      const url = this.normalizeMediaPath(image.url);
      if (url) {
        rows.push({
          id: randomUUID(),
          url,
          sortOrder: image.sortOrder ?? index,
          isPrimary: image.isPrimary ?? index === 0,
        });
      }
    }

    return rows.length ? { create: rows } : undefined;
  }

  private imageRows(
    images: CreateProductDto['images'],
    productId: string,
  ): Prisma.ProductImageCreateManyInput[] {
    const rows: Prisma.ProductImageCreateManyInput[] = [];
    for (const [index, image] of (images ?? []).entries()) {
      if (typeof image === 'string') {
        const url = this.normalizeMediaPath(image);
        if (url) rows.push({ id: randomUUID(), productId, url, sortOrder: index, isPrimary: index === 0 });
        continue;
      }

      const url = this.normalizeMediaPath(image.url);
      if (url) {
        rows.push({
          id: randomUUID(),
          productId,
          url,
          sortOrder: image.sortOrder ?? index,
          isPrimary: image.isPrimary ?? index === 0,
        });
      }
    }
    return rows;
  }

  private videoWrites(videos?: CreateProductDto['videos']) {
    const rows: Prisma.ProductVideoCreateWithoutProductInput[] = [];
    for (const [index, video] of (videos ?? []).entries()) {
      if (typeof video === 'string') {
        const videoUrl = this.normalizeMediaPath(video);
        if (videoUrl) rows.push({ id: randomUUID(), videoUrl, sortOrder: index });
        continue;
      }

      const videoUrl = this.normalizeMediaPath(video.videoUrl ?? video.url);
      if (videoUrl) {
        rows.push({ id: randomUUID(), videoUrl, sortOrder: video.sortOrder ?? index });
      }
    }

    return rows.length ? { create: rows } : undefined;
  }

  private videoRows(
    videos: CreateProductDto['videos'],
    productId: string,
  ): Prisma.ProductVideoCreateManyInput[] {
    const rows: Prisma.ProductVideoCreateManyInput[] = [];
    for (const [index, video] of (videos ?? []).entries()) {
      if (typeof video === 'string') {
        const videoUrl = this.normalizeMediaPath(video);
        if (videoUrl) rows.push({ id: randomUUID(), productId, videoUrl, sortOrder: index });
        continue;
      }

      const videoUrl = this.normalizeMediaPath(video.videoUrl ?? video.url);
      if (videoUrl) {
        rows.push({ id: randomUUID(), productId, videoUrl, sortOrder: video.sortOrder ?? index });
      }
    }
    return rows;
  }

  private toFrontendProduct(product: ProductWithRelations) {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      brand: product.brand,
      price: product.price ?? 0,
      unit: product.unit.toLowerCase(),
      stockQuantity: product.stockQuantity ?? 0,
      lowStockThreshold: product.lowStockThreshold ?? 5,
      customUnit: product.customUnit,
      status: product.status.toLowerCase(),
      stockStatus: this.inventory.stockStatus(product.stockQuantity, product.lowStockThreshold),
      deletedAt: product.status === ProductStatus.DELETED ? product.updatedAt : null,
      deletedBy: null,
      categoryId: product.categoryId,
      category: product.categoryId,
      categoryName: product.Category?.name ?? null,
      categorySlug: product.Category?.slug ?? null,
      shortDescription: product.shortDescription || product.description || '',
      fullDescription: product.fullDescription || product.description || '',
      specifications: Object.fromEntries(
        product.Specification.map((spec) => [spec.key, spec.value]),
      ),
      rating: product.rating,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      seoKeywords: product.seoKeywords,
      variants: product.Variant.map((variant) => ({
        id: variant.id,
        name: variant.name,
        label: variant.name,
        sku: variant.sku,
        price: variant.price,
        stockQuantity: variant.stockQuantity ?? 0,
        lowStockThreshold: variant.lowStockThreshold ?? 5,
        unit: variant.unit?.toLowerCase(),
        customUnit: variant.customUnit,
        imageUrl: this.publicMediaUrl(variant.imageUrls[0]) ?? null,
        imageUrls: variant.imageUrls?.length
          ? variant.imageUrls.map((url) => this.publicMediaUrl(url))
          : [],
        stockStatus: this.inventory.stockStatus(variant.stockQuantity, variant.lowStockThreshold),
        sortOrder: variant.sortOrder,
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt,
      })),
      images: product.ProductImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => this.publicMediaUrl(image.url)),
      imageObjects: product.ProductImage
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => ({
          id: image.id,
          url: this.publicMediaUrl(image.url),
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
          createdAt: image.createdAt,
        })),
      videos: product.ProductVideo
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((video) => this.publicMediaUrl(video.videoUrl)),
      videoObjects: product.ProductVideo
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((video) => ({
          id: video.id,
          url: this.publicMediaUrl(video.videoUrl),
          videoUrl: this.publicMediaUrl(video.videoUrl),
          sortOrder: video.sortOrder,
          createdAt: video.createdAt,
        })),
      buyEnabled: product.buyEnabled,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private normalizeMediaPath(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    try {
      const parsed = new URL(trimmed);
      const path = parsed.pathname.replace(/^\/+/, '');
      return path.replace(/^api\/uploads\//, 'uploads/');
    } catch {
      return trimmed.replace(/^\/+/, '').replace(/^api\/uploads\//, 'uploads/');
    }
  }

  private publicMediaUrl(value?: string | null): string {
    if (!value) {
      return '';
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    const publicBaseUrl = (this.config.get<string>('uploads.publicBaseUrl') ?? '').replace(/\/+$/, '');
    return `${publicBaseUrl}/${value.replace(/^\/+/, '')}`;
  }
}
