import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

const reviewInclude = { Product: true, ReviewMedia: true } satisfies Prisma.ReviewInclude;

type ReviewWithRelations = Prisma.ReviewGetPayload<{
  include: typeof reviewInclude;
}>;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const reviews = await this.prisma.review.findMany({
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
    });
    return reviews.map((review) => this.toFrontendReview(review));
  }

  async create(dto: CreateReviewDto) {
    const review = await this.prisma.review.create({
      data: {
        id: randomUUID(),
        productId: dto.productId,
        userId: dto.userId ?? null,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
        status: dto.status ?? 'pending',
        updatedAt: new Date(),
        ReviewMedia: this.mediaWrites(dto.media),
      },
      include: reviewInclude,
    });
    return this.toFrontendReview(review);
  }

  async update(id: string, dto: UpdateReviewDto) {
    await this.ensureExists(id);
    const review = await this.prisma.transaction(async (tx) => {
      if (dto.media) {
        await tx.reviewMedia.deleteMany({ where: { reviewId: id } });
      }

      return tx.review.update({
        where: { id },
        data: {
          productId: dto.productId,
          userId: dto.userId,
          rating: dto.rating,
          title: dto.title,
          comment: dto.comment,
          status: dto.status,
          ReviewMedia: this.mediaWrites(dto.media),
        },
        include: reviewInclude,
      });
    });
    return this.toFrontendReview(review);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.review.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Review not found');
    }
  }

  private mediaWrites(media?: CreateReviewDto['media']) {
    const rows: Prisma.ReviewMediaCreateWithoutReviewInput[] = [];
    for (const item of media ?? []) {
      const fileUrl = item.fileUrl ?? item.file_url;
      if (fileUrl) {
        rows.push({
          id: randomUUID(),
          fileUrl,
          fileType: item.fileType ?? item.file_type ?? 'image',
        });
      }
    }

    if (!rows.length) {
      return undefined;
    }

    return { create: rows };
  }

  private toFrontendReview(review: ReviewWithRelations) {
    return {
      id: review.id,
      productId: review.productId,
      userId: review.userId,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      product: review.Product
        ? {
            id: review.Product.id,
            name: review.Product.name,
          }
        : undefined,
      media: review.ReviewMedia.map((item) => ({
        id: item.id,
        fileUrl: item.fileUrl,
        file_url: item.fileUrl,
        fileType: item.fileType,
        file_type: item.fileType,
        createdAt: item.createdAt,
      })),
    };
  }
}
