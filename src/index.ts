import { config as loadEnv } from 'dotenv';
import { CreateSessionParams } from '@nitro-svm/simulation-bindings';
import { Simulation, SimulationConfig, SimulationParams } from './sim';

loadEnv({ path: '.env.local' });

async function main() {
  const config: SimulationConfig = {
    simulationCreationUrl: process.env.SIMULATION_CREATION_URL || '',
    simulationApiKey: process.env.SIMULATION_API_KEY || '',
  };

  const START_SLOT = 370_980_636;

  const createSessionParams: CreateSessionParams = {
    startSlot: START_SLOT,
    endSlot: START_SLOT + 100,
    accountEvents: [],
    signerFilter: [],
    preloadPrograms: [],
    deferCleanup: false,
  };

  const params: SimulationParams = {
    createSessionParams,
    slotInterval: 10, // Advance all 10 slots in one step
    runName: 'experiment-1',
    programSubscriptions: ['jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC'],
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
