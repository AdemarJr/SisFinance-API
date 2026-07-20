import { isPostgresConfigured } from '../config.js';
import * as initPg from './init-db-pg.js';
import * as initSupabase from './init-db-supabase.js';

export const initializeDatabase = () =>
  isPostgresConfigured() ? initPg.initializeDatabase() : initSupabase.initializeDatabase();

export const checkDatabaseStatus = () =>
  isPostgresConfigured() ? initPg.checkDatabaseStatus() : initSupabase.checkDatabaseStatus();
