/**
 * @file index.js
 * Sentinel Contracts — barrel re-export
 *
 * Import from here anywhere you need access to contracts:
 *
 *   const { trafficModel, ipcContract, dbSchema } = require('../contracts');
 */

'use strict';

const trafficModel = require('./traffic-model');
const ipcContract  = require('./ipc-contract');
const dbSchema     = require('./db-schema');

module.exports = {
  trafficModel,
  ipcContract,
  dbSchema,
};
