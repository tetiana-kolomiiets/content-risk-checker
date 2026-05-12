import { ApiProperty } from '@nestjs/swagger';

export class FlaggedFragmentDto {
  @ApiProperty()
  text: string;

  @ApiProperty()
  reason: string;
}
