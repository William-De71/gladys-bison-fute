// -----------------------------------------------------------------------------
// Entry point of the Bison Futé external integration.
//
// Brings the French road information of Bison Futé into Gladys, from its open
// data (no account, no key):
//   - devices: one per place (a house of Gladys or a commune), with the road
//     events around it on the national road network (closures, accidents,
//     traffic jams, roadworks) and the green / orange / red / black traffic
//     forecast of its department (see src/device.js);
//   - scene triggers: road event started, ended, planned; forecast alert;
//   - scene actions: read the road events, read the forecast;
//   - dashboard widgets: traffic, forecast.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Bison Futé integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
