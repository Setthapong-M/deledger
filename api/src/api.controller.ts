import { Controller, Get, Post, Put, Patch, Delete, Param, Req, Res } from "@nestjs/common";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { serve } from "./http-adapter.js";
import * as loginRoute from "./routes/auth/login/route.js";
import * as logoutRoute from "./routes/auth/logout/route.js";
import * as authModeRoute from "./routes/auth/mode/route.js";
import * as bootstrapRoute from "./routes/bootstrap/route.js";
import * as livenessRoute from "./routes/health/live/route.js";
import * as readinessRoute from "./routes/health/ready/route.js";
import * as closeMonthRoute from "./routes/months/[month]/close/route.js";
import * as expenseDetailRoute from "./routes/months/[month]/details/[setupItemId]/route.js";
import * as endingBalanceRoute from "./routes/months/[month]/ending-balance/route.js";
import * as incomeRoute from "./routes/months/[month]/income/route.js";
import * as updateRecurringRoute from "./routes/months/[month]/recurring-expenses/[id]/route.js";
import * as reorderRecurringRoute from "./routes/months/[month]/recurring-expenses/order/route.js";
import * as addRecurringRoute from "./routes/months/[month]/recurring-expenses/route.js";
import * as monthRoute from "./routes/months/[month]/route.js";
import * as snapshotRoute from "./routes/months/[month]/snapshots/route.js";
import * as currentMonthRoute from "./routes/months/current/route.js";
import * as historyRoute from "./routes/months/route.js";
import * as onboardingRoute from "./routes/onboarding/route.js";
import * as profileRoute from "./routes/profile/route.js";
import * as resumeRoute from "./routes/resume/route.js";
import * as calendarRoute from "./routes/calendar/route.js";
import * as clockRoute from "./routes/local/clock/route.js";
import * as trackingRoute from "./routes/tracking/options/route.js";
import * as backfillRoute from "./routes/months/backfill/route.js";
import * as restartRoute from "./routes/months/[month]/restart/route.js";

@Controller("api")
export class ApiController {
  @Get("calendar")
  async calendarGet(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => calendarRoute.GET(request));
  }

  @Patch("local/clock")
  async clockPatch(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => clockRoute.PATCH(request));
  }

  @Get("tracking/options")
  async trackingGet(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => trackingRoute.GET(request));
  }

  @Post("months/backfill")
  async backfillPost(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => backfillRoute.POST(request));
  }

  @Post("months/:month/restart")
  async restartPost(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => restartRoute.POST(request, { params: Promise.resolve({ month: params.month }) }));
  }

  @Post("auth/login")
  async loginPost(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => loginRoute.POST(request));
  }

  @Post("auth/logout")
  async logoutPost(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => logoutRoute.POST(request));
  }

  @Get("auth/mode")
  async authModeGet(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, () => authModeRoute.GET());
  }

  @Get("bootstrap")
  async bootstrapGet(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => bootstrapRoute.GET(request));
  }

  @Get("health/live")
  async livenessGet(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, () => livenessRoute.GET());
  }

  @Get("health/ready")
  async readinessGet(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => readinessRoute.GET(request));
  }

  @Post("months/:month/close")
  async closeMonthPost(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => closeMonthRoute.POST(request, { params: Promise.resolve({ month: params.month }) }));
  }

  @Put("months/:month/details/:setupItemId")
  async expenseDetailPut(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => expenseDetailRoute.PUT(request, { params: Promise.resolve({ month: params.month, setupItemId: params.setupItemId }) }));
  }

  @Delete("months/:month/details/:setupItemId")
  async expenseDetailDelete(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => expenseDetailRoute.DELETE(request, { params: Promise.resolve({ month: params.month, setupItemId: params.setupItemId }) }));
  }

  @Put("months/:month/ending-balance")
  async endingBalancePut(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => endingBalanceRoute.PUT(request, { params: Promise.resolve({ month: params.month }) }));
  }

  @Put("months/:month/income")
  async incomePut(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => incomeRoute.PUT(request, { params: Promise.resolve({ month: params.month }) }));
  }

  @Patch("months/:month/recurring-expenses/:id")
  async updateRecurringPatch(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => updateRecurringRoute.PATCH(request, { params: Promise.resolve({ month: params.month, id: params.id }) }));
  }

  @Put("months/:month/recurring-expenses/order")
  async reorderRecurringPut(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => reorderRecurringRoute.PUT(request, { params: Promise.resolve({ month: params.month }) }));
  }

  @Post("months/:month/recurring-expenses")
  async addRecurringPost(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => addRecurringRoute.POST(request, { params: Promise.resolve({ month: params.month }) }));
  }

  @Get("months/current")
  async currentMonthGet(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => currentMonthRoute.GET(request));
  }

  @Get("months/:month")
  async monthGet(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => monthRoute.GET(request, { params: Promise.resolve({ month: params.month }) }));
  }

  @Post("months/:month/snapshots")
  async snapshotPost(@Req() req: ExpressRequest, @Res() res: ExpressResponse, @Param() params: Record<string, string>): Promise<void> {
    await serve(req, res, request => snapshotRoute.POST(request, { params: Promise.resolve({ month: params.month }) }));
  }


  @Get("months")
  async historyGet(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => historyRoute.GET(request));
  }

  @Post("onboarding")
  async onboardingPost(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => onboardingRoute.POST(request));
  }

  @Get("profile")
  async profileGet(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => profileRoute.GET(request));
  }

  @Patch("profile")
  async profilePatch(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => profileRoute.PATCH(request));
  }

  @Post("resume")
  async resumePost(@Req() req: ExpressRequest, @Res() res: ExpressResponse): Promise<void> {
    await serve(req, res, request => resumeRoute.POST(request));
  }
}
