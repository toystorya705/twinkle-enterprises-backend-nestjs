import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify } from '../../shared/utils/slugify';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        id: randomUUID(),
        name: dto.name,
        slug: dto.slug ? slugify(dto.slug) : slugify(dto.name),
        parentId: dto.parentId ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        updatedAt: new Date(),
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);
    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug ? slugify(dto.slug) : undefined,
        parentId: dto.parentId,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.category.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Category not found');
    }
  }
}
