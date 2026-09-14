import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

// Liveness check only for now: is the process up and serving requests?
// Dependency checks (DB/Redis reachability) are a deliberate later addition
// (see roadmap Phase 7 / Observability), not required for Phase 0.
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
