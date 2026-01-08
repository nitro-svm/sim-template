import { config as loadEnv } from 'dotenv';
import { CreateSessionParams } from '@nitro-stream/bindings';
import { Simulation, SimulationConfig, SimulationParams } from './sim';

loadEnv({ path: '.env.local' });

async function main() {
  const config: SimulationConfig = {
    simulationCreationUrl: process.env.SIMULATION_CREATION_URL || '',
    simulationApiKey: process.env.SIMULATION_API_KEY || '',
  };

  // Example params, replace with desired values
  const createSessionParams: CreateSessionParams = {
    startSlot: 381_448_590, // 2025-11-21 01:52:31.000 UTC
    endSlot: 381_450_590,   // 2025-11-21 02:05:41.000 UTC
    accountEvents: [],
    signerFilter: [],
    preloadPrograms: [],
    deferCleanup: false,
  };

  const params: SimulationParams = {
    createSessionParams,
    slotInterval: 10, // Process every 10 slots
    runName: 'experiment-1',
  };

  // Create and run the sim
  const sim = new Simulation(params, config);

  try {
    await sim.run();
  } catch (error) {
    console.error('Simulation failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
