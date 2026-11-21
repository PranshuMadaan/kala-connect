const { spawn, fork } = require('child_process');
const http = require('http');
const path = require('path');

async function waitForServer(port, path = '/health', maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

async function main() {
  console.log('Starting Python FastAPI optimizer microservice on port 8000...');
  const pythonPath = 'C:\\Users\\Pranshu\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe';
  const optimizer = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: path.resolve(__dirname, '../optimizer-service'),
    stdio: 'inherit'
  });

  const optReady = await waitForServer(8000, '/health', 15);
  if (optReady) {
    console.log('FastAPI optimizer microservice online at http://127.0.0.1:8000');
  } else {
    console.warn('FastAPI microservice did not start in time. Local fallback will be used.');
  }

  console.log('Starting Express backend server on port 5000...');
  const server = fork('dist/server.js', [], {
    env: { ...process.env, PORT: '5000', NODE_ENV: 'test', OPTIMIZER_SERVICE_URL: 'http://127.0.0.1:8000' },
    stdio: 'inherit'
  });

  const ready = await waitForServer(5000, '/health', 30);
  if (!ready) {
    console.error('Server failed to start in time.');
    optimizer.kill();
    server.kill();
    process.exit(1);
  }

  console.log('Backend healthy! Running test runner...');
  const runner = spawn('npx', ['ts-node', 'tests/runner.ts'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, OPTIMIZER_SERVICE_URL: 'http://127.0.0.1:8000' }
  });

  runner.on('close', (code) => {
    try { optimizer.kill(); } catch {}
    try { server.kill('SIGKILL'); } catch {}
    process.exit(code);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
