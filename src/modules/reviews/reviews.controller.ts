import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  findAll() {
    return this.reviews.findAll();
  }

  @Post()
  create(@Body() dto: CreateReviewDto) {
    return this.reviews.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviews.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reviews.remove(id);
  }
}
