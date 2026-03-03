import os from 'os';
import { spawn } from 'child_process';

function getLanIps() {
  const nets = os.networkInterfaces();
  const ips = [];

  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family !== 'IPv4') continue;
      if (net.internal) continue;
      if (!net.address) continue;
      ips.push(net.address);
    }
  }

  return [...new Set(ips)];
}

const port = process.env.PORT || '3000';
const ips = getLanIps();

console.log('');
console.log('LAN URLs for mobile testing:');
if (!ips.length) {
  console.log(`- http://<your-ip>:${port}`);
} else {
  ips.forEach((ip) => console.log(`- http://${ip}:${port}`));
}
console.log('');

const child = spawn('next', ['dev', '-H', '0.0.0.0', '-p', String(port)], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
