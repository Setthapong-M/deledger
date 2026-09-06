import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ApiController } from "./api.controller.js";
import { loadConfig } from "./server/config.js";

@Module({ controllers: [ApiController] })
class AppModule {}

export async function createApplication() {
  loadConfig();
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  return app;
}
