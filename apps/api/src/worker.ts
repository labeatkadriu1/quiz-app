async function bootstrapWorker(): Promise<void> {
  // Queue consumers will be registered here in the next implementation phase.
  process.stdout.write('Worker started\n');
}

void bootstrapWorker();
