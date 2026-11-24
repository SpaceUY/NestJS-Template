import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { ApplePayRequestDto } from './dto/apple-pay-request.dto';
import { ApplePayResponseDto } from './dto/apple-pay-response.dto';
import { GooglePayRequestDto } from './dto/google-pay-request.dto';
import { GooglePayResponseDto } from './dto/google-pay-response.dto';
import { WalletProvisioningService } from './wallet-provisioning.service';

@ApiTags('wallet-provisioning')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('cards/me/wallet')
export class WalletProvisioningController {
  constructor(private readonly service: WalletProvisioningService) {}

  @Post('apple-pay')
  @HttpCode(200)
  @ApiOperation({ summary: 'Encrypted card data for Apple Wallet' })
  @ApiResponse({ status: 200, type: ApplePayResponseDto })
  @ApiResponse({ status: 400, description: 'Card not eligible' })
  @ApiResponse({ status: 502, description: 'Card processor unavailable' })
  applePay(
    @Body() body: ApplePayRequestDto,
    @CurrentUser() user: User,
  ): Promise<ApplePayResponseDto> {
    return this.service.getApplePayData(user.uuid, body);
  }

  @Post('google-pay')
  @HttpCode(200)
  @ApiOperation({ summary: 'Opaque payment cards (OPCs) for Google Wallet' })
  @ApiResponse({ status: 200, type: GooglePayResponseDto })
  @ApiResponse({ status: 400, description: 'Card not eligible' })
  @ApiResponse({ status: 502, description: 'Card processor unavailable' })
  googlePay(
    @Body() body: GooglePayRequestDto,
    @CurrentUser() user: User,
  ): Promise<GooglePayResponseDto> {
    return this.service.getGooglePayData(user.uuid, body);
  }
}
