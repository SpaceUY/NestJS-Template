import { InjectionToken, ModuleMetadata } from '@nestjs/common';
import { ClassConstructor } from 'class-transformer';
import Joi = require('joi');
import { ConfigProviderService } from './config-provider.service';

export interface ConfigScopeFieldMapping {
  source: string;
  key: string;
}

export interface ConfigScopeDefinition<T> {
  KEY: string;
  name: string;
  fields: Record<string, ConfigScopeFieldMapping>;
  schema?: Joi.ObjectSchema<T>;
  live?: boolean;
}

export interface ConfigProviderSourceSync {
  useClass?: ClassConstructor<ConfigProviderService>;
  useValue?: ConfigProviderService;
}

export interface ConfigProviderModuleOptions {
  isGlobal?: boolean;
  sources: Record<string, ConfigProviderSourceSync>;
  scopes?: ConfigScopeDefinition<Record<string, unknown>>[];
}

export interface ConfigProviderSourceAsync {
  imports?: ModuleMetadata['imports'];
  inject?: InjectionToken[];
  useFactory: (...args: any[]) => Promise<ConfigProviderService> | ConfigProviderService;
}

export interface ConfigProviderModuleAsyncOptions {
  isGlobal?: boolean;
  sources: Record<string, ConfigProviderSourceAsync>;
  scopes?: ConfigScopeDefinition<Record<string, unknown>>[];
}
