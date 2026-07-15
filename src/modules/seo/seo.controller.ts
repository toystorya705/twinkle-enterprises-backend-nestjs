import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
// Import your @Public() decorator if you use JWT authentication
// import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class SeoController {
  constructor(private readonly prisma: PrismaService) {}
@Get('sitemap.xml')
async sitemap(@Res() res: Response) {
  const baseUrl = 'https://twinkleenterprises.com';

  const [products, categories] = await Promise.all([
    this.prisma.product.findMany({
      where: {
        isActive: true,
        status: 'ACTIVE',
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
    this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),
  ]);

  const urls: string[] = [];

  urls.push(`
    <url>
      <loc>${baseUrl}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
    </url>
  `);

  for (const category of categories) {
    urls.push(`
      <url>
        <loc>${baseUrl}/categories/${category.slug}</loc>
        <lastmod>${category.updatedAt.toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>
    `);
  }

  for (const product of products) {
    urls.push(`
      <url>
        <loc>${baseUrl}/products/${product.slug}</loc>
        <lastmod>${product.updatedAt.toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
      </url>
    `);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  return res.send(xml);
}
 @Get('robots.txt')
robots(@Res() res: Response) {
  res.setHeader('Content-Type', 'text/plain');
  return res.send(`User-agent: *
Allow: /

Sitemap: https://twinkleenterprises.com/sitemap.xml`);
}
}